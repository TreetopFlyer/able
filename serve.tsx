import * as MIME from "https://deno.land/std@0.180.0/media_types/mod.ts";
import * as HTTP from "https://deno.land/std@0.177.0/http/server.ts";
import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";

type DenoConfig = {imports:Record<string, string>};
const ImportMap:DenoConfig = {imports:{}};
const ImportMapReload =async()=>
{
    let json:DenoConfig;
    const path = Configuration.Proxy+"/deno.json";
    try
    {
        const resp = await fetch(path);
        json = await resp.json();
        if(!json?.imports)
        { throw new Error("imports not specified in deno.json") }
    }
    catch(e)
    {
        console.log(`error reading deno config "${path}" message:"${e}"`);
        return;
    }
    ImportMap.imports = Configuration.Remap(json.imports);
};

type CustomHTTPHandler = (inReq:Request, inURL:URL, inExt:string|false, inMap:{imports:Record<string, string>})=>void|false|Response|Promise<Response|void|false>;
type CustomRemapper = (inImports:Record<string, string>)=>Record<string, string>;
type Configuration = {Proxy:string, Allow:string, Reset:string, SWCOp:SWCW.Options, Serve:CustomHTTPHandler, Shell:CustomHTTPHandler, Remap:CustomRemapper};
type ConfigurationArgs = {Proxy?:string, Allow?:string, Reset?:string, SWCOp?:SWCW.Options, Serve?:CustomHTTPHandler, Shell?:CustomHTTPHandler, Remap?:CustomRemapper};
let Configuration:Configuration =
{
    Proxy: `file://${Deno.cwd().replaceAll("\\", "/")}`,
    Allow: "*",
    Reset: "/clear-cache",
    Serve(inReq, inURL, inExt, inMap){},
    Remap: (inImports)=>
    {
        Object.entries(inImports).forEach(([key, value])=>
        {
            if(value.startsWith("./"))
            {
                inImports[key] = value.substring(1);
            }
        });
        const reactURL = inImports["react"] ?? console.log("React is not defined in imports");
        const setting = Configuration.SWCOp?.jsc?.transform?.react;
        if(setting)
        {
            setting.importSource = reactURL;
        }
        console.log(inImports);
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
                       import Mount from "/_lib_/mount.tsx";
                       Mount("#app", "@app");
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
            target:"es2022",
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
                console.log(`Transpile.Fetch error. Key:"${inKey}" Path:"${inPath}" Error:"${e}"`);
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

export const Configure =(config:ConfigurationArgs)=>
{
    Configuration = {...Configuration, ...config};
    ImportMapReload();
}

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

    // transpileable files
    if(Transpile.Check(ext))
    {
        if(url.pathname.startsWith("/_lib_/"))
        {
            const path = import.meta.url+"/.."+url.pathname;
            const code = await Transpile.Fetch(path, url.pathname, true);
            if(code)
            {
                return new Response(code, {headers:{"content-type":"application/javascript"}});
            }
        }
        else
        {
            const lookup = await Transpile.Fetch(Configuration.Proxy + url.pathname, url.pathname);
            return new Response(lookup, {status:lookup?200:404, headers:{...headers, "content-type":"application/javascript"}} );            
        }
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