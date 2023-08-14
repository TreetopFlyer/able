import { parse as JSONC } from "https://deno.land/x/jsonct@v0.1.0/mod.ts";

type ConfigCheck = {path?:string, text?:string, json?:Record<string, string|Record<string, string|string[]>>};
type ConfigCheckPair = [config:ConfigCheck, imports:ConfigCheck];

export const RootHost = import.meta.resolve("./");
export const Root = new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString();
export async function HuntConfig()
{
    let path:string, resp:Response, text="", json;
    try
    {
        path = "deno.json"
        resp = await fetch(Root + "/" + path);
        text = await resp.text();
    }
    catch(e)
    {
        try
        {
            path = "deno.jsonc";
            resp = await fetch(Root + "/" + path);
            text = await resp.text();
        }
        catch(e)
        {
            try
            {
                path = ".vscode/settings.json";
                resp = await fetch(Root + "/" + path);
                json = await resp.json();

                path = json["deno.config"];
                json = undefined;
                if(path)
                {
                    resp = await fetch(Root + "/" + path);
                    text = await resp.text();
                }
            }
            catch(e)
            {
                path = "";
            }
        }
    }

    if(path)
    {
        try
        {
            json = JSONC(text);
        }
        catch(e)
        {
            json = undefined;
        }
    }

    let imports:ConfigCheck = {};
    if(json && json.imports)
    {
        // config.imports
        imports.json = json;
        imports.text = JSON.stringify(json);
        imports.path = path;
    }
    else if(json && !json.imports && json.importMap)
    {
        // config.importMap
        try
        {
            imports.path = json.importMap;
            resp = await fetch(Root + "/" + imports.path);
            imports.text = await resp.text();
            try
            {
                imports.json = JSONC(imports.text);
            }
            catch(e)
            {
                imports.json = undefined;
            }
        }
        catch(e)
        {
            // malformed import map
        }
    }

    return [{path, text, json}, imports] as ConfigCheckPair
}

export async function Install(file:string, overrideName?:string, handler?:(content:string)=>string)
{
    const pathFile = RootHost + "install__/" + file;

    try{
        const check = await Deno.readTextFile(Deno.cwd()+"/"+file);
        const replace = confirm(`⚠️🚧 The file "${file}" already exists. Replace it?`);
        if(replace)
        {
            throw("")
        }
        console.log(`Using pre-existing "${file}" for now.`);
    }
    catch(e)
    {
        const resp = await fetch(pathFile);
        const text = await resp.text();
        const name = overrideName || file;
        await Deno.writeTextFile(Deno.cwd()+"/"+name, handler ? handler(text) : text);   
    }
}

export async function Check()
{
    try
    {
        let [config, imports] = await HuntConfig();
        //console.log(config, imports);
        if(!config.path)
        {
            console.log(`🛠️ No Deno configuration found. Creating "deno.jsonc" now.`);
            await Deno.writeTextFile(Deno.cwd()+"/deno.jsonc", `{"imports":{}}`);   
            Check();
            return;
        }
        else if(!config.json)
        {
            if(confirm(`🚧 Deno configuration is malformed. Replace "${config.path}" with a new one?.`))
            {
                await Deno.writeTextFile(Deno.cwd()+"/"+config.path, `{"imports":{}}`);   
                Check();
                return;
            }
            else
            {
                throw("⛔ Invalid configuration.");
            }
        }
        else if(!imports.json)
        {        
            if(imports.path != config.path)
            {
                if(confirm(`🚧 External import map "${imports.path}" is missing or malformed. Replace it with defaults?.`))
                {
                    await Deno.writeTextFile(Deno.cwd()+"/"+imports.path, `{"imports":{}}`);   
                    Check();
                    return;
                }
                else
                {
                    throw("⛔ Invalid configuration.");
                }
            }
        }
        else if(!imports.json?.imports)
        {
            imports.json.imports = {};
        }

        if(config.json && imports.json?.imports)
        {
            const importMap = imports.json.imports as Record<string, string>;
            const bake =async(obj:ConfigCheck)=> await Deno.writeTextFile(Deno.cwd()+"/"+obj.path, JSON.stringify(obj.json, null, "\t")); 

            if(!importMap["react"])
            {
                console.log(`🛠️ Adding React import specifier ("react")`);
                importMap["react"] = `https://esm.sh/preact@10.16.0/compat`;
                importMap["react/"] = `https://esm.sh/preact@10.16.0/compat/`;
                await bake(imports);
                console.log(`🚦 NOTE: Deno will need to cache "react" for intellisense to work properly.`)

            }
            if(!importMap[">able/"])
            {
                console.log(`🛠️ Adding Able import specifier (">able/").`);
                importMap[">able/"] = `${RootHost}`;
                await bake(imports); 
            }

            if(!importMap[">able/app.tsx"])
            {
                if(confirm(`🤔 OPTIONAL: Your import map does not override the default/empty FRONT-END app with the specifier ">able/app.tsx". Create this file and add the specifier?`))
                {
                    importMap[">able/app.tsx"] = `./app.tsx`;
                    await bake(imports); 
                    await Install("app.tsx");
                }
            }
            else
            {
                try
                {
                    const app = await import(importMap[">able/app.tsx"]);
                    // @ts-ignore
                    const result = app.default().$$typeof;
                }
                catch(e)
                {
                    console.log(e);
                    if(confirm(`🚧 Your FRONT-END app ("${importMap[">able/app.tsx"]}") does not export a default function that returns VDOM nodes. Replace it?`))
                    {
                        await Install("app.tsx", importMap[">able/app.tsx"]);
                    }
                    else
                    {
                        throw("⛔ Your FRONT-END app has incorrect export types.");
                    }
                }
            }

            if(!importMap[">able/api.tsx"])
            {
                if(confirm(`🤔 OPTIONAL: Your import map does not override the default/empty BACK-END api with the specifier ">able/api.tsx". Create this file and add the specifier?`))
                {
                    importMap[">able/api.tsx"] = "./api.tsx";
                    await bake(imports); 
                    await Install("api.tsx");
                }
            }
            else
            {
                try
                {
                    const api = await import(importMap[">able/api.tsx"]);
                    const result = api.default(new Request(new URL("https://fake-deno-testing-domain.com/")));
                }
                catch(e)
                {
                    if(confirm(`🚧 Your starter backend app ("${importMap[">able/api.tsx"]}") does not export a default function that accepts a Request. Replace it?`))
                    {
                        await Install("api.tsx", importMap[">able/api.tsx"]);
                    }
                    else
                    {
                        throw("⛔ Starter backend app has incorrect export types.");
                    }
                }
            }


            const options = 
            {
                "lib": ["deno.window", "dom", "dom.asynciterable"],
                "jsx": "react-jsx",
                "jsxImportSource": "react"
            }

            const compOpts = config.json.compilerOptions as Record<string, string|string[]> || {};
            const compJSX = compOpts.jsx == options.jsx;
            const compJSXImportSource = compOpts.jsxImportSource == options.jsxImportSource;
            const compLib:string[] = compOpts.lib as string[] || [];
            let compLibHasAll = true;
            options.lib.forEach(item=> !compLib.includes(item) && (compLibHasAll = false))

            if(!compOpts || !compJSX || !compJSXImportSource || !compLibHasAll)
            {
                console.log(`🛠️ Adding values to "compilerOptions" configuration.`);
                compOpts.jsx = options.jsx;
                compOpts.jsxImportSource = options.jsxImportSource;
                compOpts.lib = [...compLib, ...options.lib];
                config.json.compilerOptions = compOpts;
                await bake(config);
            }


        }
    }
    catch(e)
    {
        console.log(e, "\n (Able Exiting...)");
        Deno.exit();
    }
    console.log(`🚗 Good to go!`);

}

Check();