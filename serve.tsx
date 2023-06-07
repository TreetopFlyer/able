import * as MIME from "https://deno.land/std@0.180.0/media_types/mod.ts";
import * as HTTP from "https://deno.land/std@0.177.0/http/server.ts";
import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";

export type Configuration = {Proxy:string, Allow:string, Reset:string, Local:boolean};
export type ConfigurationArgs = {Proxy?:string, Allow?:string, Reset?:string, Local?:boolean};
export let Configure:Configuration =
{
    Proxy: "",
    Allow: "*",
    Reset: "/clear-cache",
    Local: false
};

export default (config:ConfigurationArgs)=> Configure = {...Configure, ...config};
export const Transpile = {
    Config:
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
        },
    } as SWCW.Options,
    Cache: new Map() as Map<string, string>,
    Clear()
    {
        const size = this.Cache.size;
        this.Cache.clear();
        return size;
    },
    Fetch: async function(inPath:string, inKey:string, inCheckCache=true)
    {
        console.log("transpile", inPath)
        if(inPath.endsWith(".tsx") || inPath.endsWith(".jsx") || inPath.endsWith(".js") || inPath.endsWith(".mjs"))
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
                    const {code} = await SWCW.transform(text, {...this.Config, filename:inKey});
                    this.Cache.set(inKey, code);
                    return code;
                }
                catch(e)
                {
                    console.log(`xpile.tsx error. Key:${inKey} Path:${inPath} Error:"${e}"`);
                    return null;
                }
            }
        }
        else
        {
            return false;
        }
    }
};

SWCW.default();
console.log("starting server");
HTTP.serve(async(req: Request)=>
{
    const url:URL = new URL(req.url);

    if(url.pathname.endsWith("/"))
    {
        
    }
    if(url.pathname === Configure.Reset)
    {
        return new Response(`cache cleared (${Transpile.Clear()} items)`);
    }

    const lookup = await Transpile.Fetch(Configure.Proxy + url.pathname, url.pathname);
    if(lookup === null)
    {
        // error
        return new Response(`transpile error (see console)`, {status:404, headers:{"content-type":"application/javascript", "Access-Control-Allow-Origin": Configure.Allow, charset:"utf-8"}});
    }
    else if(lookup === false)
    {
        // not a javascript file
        try
        {
            const type = MIME.typeByExtension(url.pathname.substring(url.pathname.lastIndexOf("."))) || "text/html";
            const file = await fetch(Configure.Proxy + url.pathname);
            const text = await file.text();
            return new Response(text, {headers:{"content-type":type, "Access-Control-Allow-Origin":Configure.Allow, charset:"utf-8"}});
        }
        catch(e)
        {
            return new Response(`404 ${Configure.Proxy + url.pathname}`, {status:404});
        }
    }
    else
    {
        return new Response(lookup, {headers:{"content-type":"application/javascript", "Access-Control-Allow-Origin": Configure.Allow, charset:"utf-8"}});
    }
});