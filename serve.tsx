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
    confText && (ImportMap.imports = Configuration.Remap(JSON.parse(confText)?.imports || {}));
};

type CustomHTTPHandler = (inReq:Request, inURL:URL, inExt:string|false, inMap:{imports:Record<string, string>})=>false|Response|Promise<Response|false>;
type CustomRemapper = (inImports:Record<string, string>)=>Record<string, string>;
type Configuration = {Proxy:string, Allow:string, Reset:string, SWCOp:SWCW.Options, Serve:CustomHTTPHandler, Shell:CustomHTTPHandler, Remap:CustomRemapper};
type ConfigurationArgs = {Proxy?:string, Allow?:string, Reset?:string, SWCOp?:SWCW.Options, Serve?:CustomHTTPHandler, Shell?:CustomHTTPHandler, Remap?:CustomRemapper};
let Configuration:Configuration =
{
    Proxy: `file://${Deno.cwd().replaceAll("\\", "/")}`,
    Allow: "*",
    Reset: "/clear-cache",
    Serve(inReq, inURL, inExt, inMap)
    {
        return false;
    },
    Remap: (inImports)=>
    {
        Object.entries(inImports).forEach(([key, value])=>
        {
            if(value.startsWith("./"))
            {
                inImports[key] = value.substring(1);
            }
        });
        Configuration.SWCOp.jsc.transform.react.importSource = inImports["react"];
        return inImports;
    },
    Shell(inReq, inURL, inExt, inMap)
    {
        return new Response(
            `<!doctype html>
            <html>
                <head>
                </head>
                <body>
                    <div id="app"></div>
                    <script type="importmap">${JSON.stringify(inMap)}</script>
                    <script type="module">
                        import App from "app";
                        import React from "react";
                        React.render(React.createElement(App), document.querySelector("#app"))
                    </script>
                </body>
            </html>`, {status:200, headers:{"content-type":"text/html"}});
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
                const {code} = await SWCW.transform(text, { ...Configuration.SWCOp, filename:inKey});
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

export const Configure =(config:ConfigurationArgs)=> Configuration = {...Configuration, ...config};

await ImportMapReload();
await SWCW.default();
HTTP.serve(async(req: Request)=>
{
    const url:URL = new URL(req.url);
    const ext = Extension(url.pathname);
    const headers = {"content-type":"application/json", "Access-Control-Allow-Origin": Configuration.Allow, "charset":"UTF-8"};

    // cache-reset route
    if(url.pathname === Configuration.Reset)
    {
        return new Response(`{"cleared":${Transpile.Clear()}}`, {headers});
    }

    // allow for custom handler
    const custom = await Configuration.Serve(req, url, ext, ImportMap);
    if(custom)
    {
        return custom;
    }

    // custom page html
    if(!ext)
    {
        const shell = await Configuration.Shell(req, url, ext, ImportMap);
        if(shell)
        {
            return shell;
        }
    }

    // transpileable files
    if(Transpile.Check(ext))
    {
        const lookup = await Transpile.Fetch(Configuration.Proxy + url.pathname, url.pathname);
        return new Response(lookup, {status:lookup?200:404, headers:{...headers, "content-type":"application/javascript"}} );
    }

    // all other static files
    if(ext)
    {
        try
        {
            const type = MIME.typeByExtension(ext);
            const file = await fetch(Configuration.Proxy + url.pathname);
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