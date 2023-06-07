import * as MIME from "https://deno.land/std@0.180.0/media_types/mod.ts";
import * as HTTP from "https://deno.land/std@0.177.0/http/server.ts";
import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";

const ImportMap = {imports:{}};
const ImportMapReload =async()=>
{
    let confText;
    try
    {
        confText = await Deno.readTextFile(Deno.cwd()+"\\deno.json");
    }
    catch(e)
    {
        console.log(`No "deno.json" file found at "${Deno.cwd()}"`);
    }
    confText && (ImportMap.imports = Configure.Remap(JSON.parse(confText)?.imports || {}));
};

type CustomHTTPHandler = (inReq:Request, inURL:URL, inExt:string|false, inMap:{imports:Record<string, string>})=>false|Response|Promise<Response|false>;
type CustomRemapper = (inImports:Record<string, string>)=>Record<string, string>;
type Configuration = {Proxy:string, Allow:string, Reset:string, SWCOp:SWCW.Options, Serve:CustomHTTPHandler, Remap:CustomRemapper};
type ConfigurationArgs = {Proxy?:string, Allow?:string, Reset?:string, SWCOp?:SWCW.Options, Serve?:CustomHTTPHandler, Remap?:CustomRemapper};
let Configure:Configuration =
{
    Proxy: "",
    Allow: "*",
    Reset: "/clear-cache",
    Serve: ()=>false,
    Remap: (inImports)=>
    {
        Object.entries(inImports).forEach(([key, value])=>
        {
            if(value.startsWith("./"))
            {
                inImports[key] = value.substring(1);
            }
        });
        return inImports;
    },
    SWCOp:
    {
        sourceMaps: false,
        minify: true,
        jsc:
        {
            target:"es2017",
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
        }
    }
};

export const Transpile =
{
    Cache: new Map() as Map<string, string>,
    Files: ["tsx", "jsx", "ts", "js", "mjs"],
    Check(inExtension:string|false)
    {
        return inExtension ? this.Files.includes(inExtension) : false;
    },
    Clear()
    {
        const size = this.Cache.size;
        this.Cache.clear();
        ImportMapReload();
        return size;
    },
    Fetch: async function(inPath:string, inKey:string, inCheckCache=true)
    {
        const check = this.Cache.get(inPath);
        if(check && inCheckCache)
        {
            return check;
        }
        else
        {
            try
            {
                const resp = await fetch(inPath);
                const text = await resp.text();
                const {code} = await SWCW.transform(text, { ...Configure.SWCOp, filename:inKey});
                this.Cache.set(inKey, code);
                return code;
            }
            catch(e)
            {
                //console.log(`Transpile.Fetch error. Key:"${inKey}" Path:"${inPath}" Error:"${e}"`);
                return null;
            }
        }
    }
};

export const Extension =(inPath:string)=>
{
    const posSlash = inPath.lastIndexOf("/");
    const posDot = inPath.lastIndexOf(".");
    return posDot > posSlash ? inPath.substring(posDot+1).toLowerCase() : false;
};

export default (config:ConfigurationArgs)=> Configure = {...Configure, ...config};

await ImportMapReload();
await SWCW.default();
HTTP.serve(async(req: Request)=>
{
    const url:URL = new URL(req.url);
    const ext = Extension(url.pathname);
    const headers = {"content-type":"application/json", "Access-Control-Allow-Origin": Configure.Allow, "charset":"UTF-8"};

    // cache-reset route
    if(url.pathname === Configure.Reset)
    {
        return new Response(`{"cleared":${Transpile.Clear()}}`, {headers});
    }

    // allow for custom handler
    const custom = await Configure.Serve(req, url, ext, ImportMap);
    if(custom)
    {
        return custom;
    }

    // transpileable files
    if(Transpile.Check(ext))
    {
        const lookup = await Transpile.Fetch(Configure.Proxy + url.pathname, url.pathname);
        return new Response(lookup, {status:lookup?200:404, headers:{...headers, "content-type":"application/javascript"}} );
    }

    // all other static files
    if(ext)
    {
        try
        {
            const type = MIME.typeByExtension(ext);
            const file = await fetch(Configure.Proxy + url.pathname);
            const text = await file.text();
            return new Response(text, {headers:{...headers, "content-type":type||""}});
        }
        catch(e)
        {
            return new Response(`{"error":"${e}", "path":"${url.pathname}"}`, {status:404, headers});
        }
    }

    return new Response(`{"error":"unmatched route", "path":"${url.pathname}"}`, {status:404, headers});

});