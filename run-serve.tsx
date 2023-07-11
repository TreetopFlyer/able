import * as MIME from "https://deno.land/std@0.180.0/media_types/mod.ts";
import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";


Deno.args.forEach(arg=>
{
    if(arg.startsWith("--"))
    {
        const kvp = arg.substring(2).split("=");
        Deno.env.set(kvp[0], kvp[1] || "true");
    }
});

const urls = {
    Cwd: new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString(),
    App: Deno.mainModule,
    Mod: import.meta.url,
    Look: import.meta.resolve("./boot.tsx")
};

console.log(JSON.stringify(urls, null, " "));

type DenoConfig = {imports:Record<string, string>};
const ImportMap:DenoConfig = {imports:{}};
let ImportMapOriginal = {};
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
        ImportMapOriginal = json;
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

    if(!json.imports["react"])
    {
        console.log(`"react" specifier not defined in import map`);
    }

    ImportMap.imports = Configuration.Remap(json.imports, Configuration);
    console.log(ImportMap.imports);
};

type CustomHTTPHandler = (inReq:Request, inURL:URL, inExt:string|false, inMap:{imports:Record<string, string>}, inConfig:Configuration)=>void|false|Response|Promise<Response|void|false>;
type CustomRemapper = (inImports:Record<string, string>, inConfig:Configuration)=>Record<string, string>;
type Configuration     = {Proxy:string, Allow:string, Reset:string, SWCOp:SWCW.Options, Serve:CustomHTTPHandler, Shell:CustomHTTPHandler, Remap:CustomRemapper};
type ConfigurationArgs = {Proxy?:string, Allow?:string, Reset?:string, SWCOp?:SWCW.Options, Serve?:CustomHTTPHandler, Shell?:CustomHTTPHandler, Remap?:CustomRemapper};
let Configuration:Configuration =
{
    Proxy: new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString(),
    Allow: "*",
    Reset: "/clear-cache",
    async Serve(inReq, inURL, inExt, inMap, inConfig){},
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
                        import Mount from "${import.meta.resolve("./boot.tsx")}";
                        Mount("#app", document.location.origin+"${parts[1]??"/app.tsx"}");
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
    /**
     * Converts dynamic module imports in to static, also can resolve paths with an import map
     */
    async Patch(inPath:string, inKey:string, inMap?:DenoConfig)
    {
        const check = this.Cache.get(inKey);
        if(check)
        {
            return check;
        }

        let file, text;
        try
        {
            file = await fetch(inPath);
            text = await file.text();
        }
        catch(e)
        {
            return false;
        }

        const remap = inMap ? (inPath:string)=>
        {
            const match = inMap.imports[inPath];
            if(match)
            {
                return match;
            }
            else if(inPath.includes("/"))
            {
                let bestKey = "";
                let bestLength = 0;
                Object.keys(inMap.imports).forEach((key, i, arr)=>
                {
                    if(key.endsWith("/") && inPath.startsWith(key) && key.length > bestLength)
                    {
                        bestKey = key;
                        bestLength = key.length;
                    }
                });
                if(bestKey)
                {
                    return inMap.imports[bestKey]+inPath.substring(bestKey.length);
                }
            }
            return inPath;
        }
        : (inPath:string)=>inPath;
        let match, regex;
        let convertedBody = text;

        // remap static imports
        regex = /from\s+(['"`])(.*?)\1/g;
        while ((match = regex.exec(text)))
        {
          const importStatement = match[0];
          const importPath = match[2];
          convertedBody = convertedBody.replace(importStatement, `from "${remap(importPath)}"`);
        }

        // convert dynamic imports into static (to work around deno deploy)
        const staticImports = [];
        regex = /(?<![\w.])import\(([^)]+)(?!import\b)\)/g;
        while ((match = regex.exec(text)))
        {
            const importStatement = match[0];
            const importPath = remap(match[1].substring(1, match[1].length-1));
            const moduleName = `_dyn_${staticImports.length}` as string;

            staticImports.push(`import ${moduleName} from ${importPath};`);
            convertedBody = convertedBody.replace(importStatement, `Promise.resolve(${moduleName})`);
        }
        convertedBody = staticImports.join("\n") + convertedBody;
        
        inKey && this.Cache.set(inKey, convertedBody);
        return convertedBody;
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


export const ExtensionPrefix =(string:string, suffix:string)=>
{
    const lastDotIndex = string.lastIndexOf(".");
    if (lastDotIndex === -1) {
        return string;
    }
    
    const prefix = string.substring(0, lastDotIndex);
    const suffixString = string.substring(lastDotIndex + 1);
    return prefix + "." + suffix + "." + suffixString;
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
const server = Deno.serve({port:parseInt(Deno.env.get("port")||"8000")}, async(req: Request)=>
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
        let file;
        if( req.headers.get("user-agent")?.startsWith("Deno") || url.searchParams.has("deno") )
        {
            try
            {
                path = Configuration.Proxy + ExtensionPrefix(url.pathname, "deno");
                console.log("looking for", path);
                file = await fetch(path) as Response;
                if(file.ok)
                {
                    code = await file.text();
                }
                else
                {
                    throw new Error("404")
                }
            }
            catch(e)
            {
                path = Configuration.Proxy + url.pathname;
                console.log("falling back to", path);
                file = await fetch(path);
                code = await file.text();
            }
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
            return new Response(file.body, {headers:{...headers, "content-type":type||""}});
        }
        catch(e)
        {
            return new Response(`{"error":"${e}", "path":"${url.pathname}"}`, {status:404, headers});
        }
    }

    return new Response(`{"error":"unmatched route", "path":"${url.pathname}"}`, {status:404, headers});

});