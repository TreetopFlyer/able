import * as MIME from "https://deno.land/std@0.180.0/media_types/mod.ts";
import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";
import { HuntConfig } from "./checker.tsx";
import CustomServe from ">able/api.tsx"; 

export const Root = new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString();

type DenoConfig = {imports:Record<string, string>};
const ImportMap:DenoConfig = {imports:{}};
let ImportMapProxies:Record<string, string> = {};

const ImportMapReload =async()=>
{
    const [, {json, path}] = await HuntConfig();
    const imports = (json as DenoConfig).imports;

    if(imports)
    {
        ImportMapProxies = {};
        Object.entries(imports).forEach(([key, value])=>
        {
            if(value.startsWith("./"))
            {
                imports[key] = value.substring(1);
            }
            if(key.startsWith(">"))
            {
                if(value.startsWith("./"))
                {
                    ImportMapProxies[encodeURI(key)] = value.substring(1);
                    imports[key] = value.substring(1); 
                }
                else
                {
                    ImportMapProxies["/"+encodeURI(key)] = value;
                    imports[key] = "/"+key;    
                }
            }
        });

        ImportMap.imports = Configuration.Remap(imports, Configuration);

    }
    else
    {

    }

};

export type CustomHTTPHandler = (inReq:Request, inURL:URL, inExt:string|false, inMap:{imports:Record<string, string>}, inConfig:Configuration)=>void|false|Response|Promise<Response|void|false>;
export type CustomRemapper = (inImports:Record<string, string>, inConfig:Configuration)=>Record<string, string>;
export type Configuration     = {Start:string, Allow:string, Reset:string, SWCOp:SWCW.Options, Serve:CustomHTTPHandler, Extra:CustomHTTPHandler, Shell:CustomHTTPHandler, Remap:CustomRemapper};
export type ConfigurationArgs = Partial<Configuration>;
let Configuration:Configuration =
{
    Start: ">able/app.tsx",
    Allow: "*",
    Reset: "/clear-cache",
    async Extra(inReq, inURL, inExt, inMap, inConfig){},
    Serve: CustomServe,
    Remap: (inImports, inConfig)=>
    {
        return inImports;
    },
    Shell(inReq, inURL, inExt, inMap, inConfig)
    {
        return new Response(
            `<!doctype html>
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
                    <meta charset="utf-8"/>
                </head>
                <body>
                    <div id="app"></div>
                    <script type="importmap">${JSON.stringify(inMap, null, " ")}</script>
                    <script type="module">
                        import Mount from ">able/run-browser.tsx";
                        Mount("#app", "${inConfig.Start}");
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
    async Fetch(inPath:string, inKey:string, inCheckCache=true)
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


let running = false;
export default async()=>
{
    if(running){return};
    running = true;
    
    try
    {
        await ImportMapReload();
        await SWCW.default();
    }
    catch(e)
    {
        console.log("swc init error:", e);
    }
    
    const server = Deno.serve({port:parseInt(Deno.env.get("port")||"8000")}, async(req: Request)=>
    {
        const url:URL = new URL(req.url);
        const ext = Extension(url.pathname);
        const headers = {"content-type":"application/json", "Access-Control-Allow-Origin": Configuration.Allow, "charset":"UTF-8"};
        let proxy = Root + url.pathname;
    
        if(url.pathname.includes("__/") || url.pathname.lastIndexOf("__.") > -1)
        {
            return new Response(`{"error":"unmatched route", "path":"${url.pathname}"}`, {status:404, headers});
        }
    
        // proxy imports
        if(url.pathname.startsWith(encodeURI("/>")))
        {
            let bestMatch="";
            for(let key in ImportMapProxies)
            {
                if(url.pathname.startsWith(key) && key.length > bestMatch.length)
                {
                    bestMatch = key;
                }
            }
            if(bestMatch.length)
            {
                const match = ImportMapProxies[bestMatch];
                const path = url.pathname.substring(bestMatch.length);
                proxy = path ? match + path : Root + match;
    
            }     
        }
    
        // allow for custom handlers
        const custom = await Configuration.Extra(req, url, ext, ImportMap, Configuration);
        if(custom)
        {
            return custom;
        }
        const api = await Configuration.Serve(req, url, ext, ImportMap, Configuration);
        if(api)
        {
            return api;
        }
    
        // transpileable files
        if(Transpile.Check(ext))
        {
            console.log("transpiling:", proxy);
            const code = await Transpile.Fetch(proxy, url.pathname);    
            if(code)
            {
                return new Response(code, {headers:{...headers, "content-type":"application/javascript"}} );     
            } 
        }
    
        // custom page html
        if(!ext)
        {
            const shell = await Configuration.Shell(req, url, ext, ImportMap, Configuration);
            if(shell)
            {
                return shell;
            }
        }
    
        // cache-reset route
        if(url.pathname === Configuration.Reset)
        {
            return new Response(`{"cleared":${Transpile.Clear()}}`, {headers});
        }
    
        // all other static files
        if(ext)
        {
            try
            {
                const type = MIME.typeByExtension(ext);
                const file = await fetch(proxy);
                return new Response(file.body, {headers:{...headers, "content-type":type||""}});
            }
            catch(e)
            {
                return new Response(`{"error":"${e}", "path":"${url.pathname}"}`, {status:404, headers});
            }
        }
    
        return new Response(`{"error":"unmatched route", "path":"${url.pathname}"}`, {status:404, headers});
    
    });
}
