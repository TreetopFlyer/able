import * as MIME from "https://deno.land/std@0.180.0/media_types/mod.ts";
import * as HTTP from "https://deno.land/std@0.177.0/http/server.ts";
import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";

type Configuration = {Proxy:string, Allow:string, Reset:string};
type ConfigurationArgs = {Proxy?:string, Allow?:string, Reset?:string};

let Configure:Configuration =
{
    Proxy: "",
    Allow: "*",
    Reset: "/clear-cache"
};
export default (config:ConfigurationArgs)=> Configure = {...Configure, ...config};

const TranspileConfig:SWCW.Options = {
  sourceMaps: true,
  minify: true,
  jsc:
  {
    minify:
    {
        compress: { unused: true },
        mangle: true
    },
    parser:
    {
        syntax: "typescript",
        tsx: true,
    },
    transform:
    {
      react: { runtime: "automatic" }
    }
  },
}
const TranspileCache:Map<string, string> = new Map();
const TranspileFetch =async(inPath:string)=>
{
    if(inPath.endsWith(".tsx") || inPath.endsWith(".jsx") || inPath.endsWith(".js") || inPath.endsWith(".mjs"))
    {
        const check = TranspileCache.get(inPath);
        if(check)
        {
            return check;
        }
        else
        {
            try
            {
                const resp = await fetch(Configure.Proxy + inPath);
                const text = await resp.text();
                const {code, map} = await SWCW.transform(text, TranspileConfig);
                TranspileCache.set(inPath, code);
                return code;
            }
            catch(e)
            {
                return null;
            }
        }
    }
    else
    {
        return false;
    }
};

await SWCW.default();
HTTP.serve(async(req: Request)=>
{
    const url:URL = new URL(req.url);

    if(url.pathname === Configure.Reset)
    {
        const size = TranspileCache.size;
        TranspileCache.clear();
        return new Response(`cache cleared (${size} items)`);
    }

    const lookup = await TranspileFetch(url.pathname);
    if(lookup === null)
    {
        // error
        return new Response(`error (see console)`, {status:404, headers:{"content-type":"application/javascript", "Access-Control-Allow-Origin": Configure.Allow, charset:"utf-8"}});
    }
    else if(lookup === false)
    {
        // not a javascript file
        const type = MIME.typeByExtension(url.pathname.substring(url.pathname.lastIndexOf("."))) || "text/html";
        const file = await fetch(Configure.Proxy + url.pathname);
        const text = await file.text();
        return new Response(text, {headers:{"content-type":type, "Access-Control-Allow-Origin":Configure.Allow, charset:"utf-8"}});
    }
    else
    {
        return new Response(lookup, {headers:{"content-type":"application/javascript", "Access-Control-Allow-Origin": Configure.Allow, charset:"utf-8"}});
    }
});