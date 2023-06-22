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

    Object.entries(json.imports).forEach(([key, value])=>
    {
        if(value.startsWith("./"))
        {
            json.imports[key] = value.substring(1);
        }
    });

    const mapKey = (Configuration.Spoof.startsWith("/") ? Configuration.Spoof.substring(1) : Configuration.Spoof)+"/";
    if(!json.imports[mapKey])
    {
        console.log(`"${mapKey}" specifier not defined in import map`);
    }
    json.imports[mapKey] = Configuration.Spoof+"/";

    if(!json.imports["react"])
    {
        console.log(`"react" specifier not defined in import map`);
    }

    ImportMap.imports = Configuration.Remap(json.imports, Configuration);
    console.log(ImportMap.imports);
};

type CustomHTTPHandler = (inReq:Request, inURL:URL, inExt:string|false, inMap:{imports:Record<string, string>}, inConfig:Configuration)=>void|false|Response|Promise<Response|void|false>;
type CustomRemapper = (inImports:Record<string, string>, inConfig:Configuration)=>Record<string, string>;
type Configuration = {Proxy:string, Spoof:string, Allow:string, Reset:string, SWCOp:SWCW.Options, Serve:CustomHTTPHandler, Shell:CustomHTTPHandler, Remap:CustomRemapper};
type ConfigurationArgs = {Proxy?:string, Spoof?:string, Allow?:string, Reset?:string, SWCOp?:SWCW.Options, Serve?:CustomHTTPHandler, Shell?:CustomHTTPHandler, Remap?:CustomRemapper};
let Configuration:Configuration =
{
    Proxy: new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString(),
    Allow: "*",
    Reset: "/clear-cache",
    Spoof: "/@able",
    Serve(inReq, inURL, inExt, inMap, inConfig){},
    Remap: (inImports, inConfig)=>
    {
        const reactURL = inImports["react"];
        const setting = Configuration.SWCOp?.jsc?.transform?.react;
        if(setting && reactURL)
        {
            setting.importSource = reactURL;
        }
        return inImports;
    },
    Shell(inReq, inURL, inExt, inMap, inConfig)
    {
        const parts = Deno.mainModule.split(inConfig.Proxy);

        return new Response(
            `<!doctype html>
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
                    <meta charset="utf-8"/>
                </head>
                <body>
                    <div id="app"></div>
                    <script type="importmap">${JSON.stringify(inMap)}</script>
                    <script type="module">
                        import Mount from "${inConfig.Spoof}/boot-browser.tsx";
                        Mount("#app", "${parts[1]??"/app.tsx"}");
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
    const custom = await Configuration.Serve(req, url, ext, ImportMap, Configuration);
    if(custom)
    {
        return custom;
    }

    // transpileable files
    if(Transpile.Check(ext))
    {
        let code;
        let path;
        if(url.pathname.startsWith(Configuration.Spoof+"/"))
        {
            const clipRoot = import.meta.url.substring(0, import.meta.url.lastIndexOf("/"));
            const clipPath = url.pathname.substring(url.pathname.indexOf("/", 1));
            if(clipPath.startsWith("/boot-"))
            {
                path = clipRoot+"/boot-browser.tsx";
            }
            else
            {
                path = clipRoot + clipPath;
            }
            code = await Transpile.Fetch(path, url.pathname, true);
        }
        else
        {
            path = Configuration.Proxy + url.pathname;
            code = await Transpile.Fetch(path, url.pathname);    
        }

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