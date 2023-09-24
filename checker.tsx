import { parse as JSONC } from "https://deno.land/x/jsonct@v0.1.0/mod.ts";

type ConfigCheck = {path?:string, text?:string, json?:Record<string, string|Record<string, string|string[]>>};
type ConfigCheckPair = [config:ConfigCheck, imports:ConfigCheck];

export const RootHost = import.meta.resolve("./");
export const Root = new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString();
export async function HuntConfig()
{
    console.log("hunting in", Root);
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
    let [config, imports] = await HuntConfig();
    try
    {
        
        //console.log(config, imports);
        if(!config.path)
        {
            console.log(`🛠️ No Deno configuration found. Creating "deno.json" now.`);
            await Deno.writeTextFile(Deno.cwd()+"/deno.json", `{"imports":{}}`);   
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

            importMap["react"] = `https://esm.sh/preact@10.17.1/compat`;
            importMap["react/"] = `https://esm.sh/preact@10.17.1/compat/`;
            importMap["@preact/signals"] = `https://esm.sh/@preact/signals@1.2.1`;
            importMap[">able/"] = `${RootHost}`;
            if(!importMap[">able/app.tsx"])
            {
                importMap[">able/app.tsx"] = `./app.tsx`;
                await Install("app.tsx");
            }
            if(!importMap[">able/api.tsx"])
            {
                if(confirm(`🤔 OPTIONAL: Add backend ">able/api.tsx"?`))
                {
                    importMap[">able/api.tsx"] = "./api.tsx";
                    await Install("api.tsx");
                }
            }

            const tasks:Record<string, string> = {
                "check": `deno run -A --no-lock ${RootHost}cli.tsx check`,
                "local": `deno run -A --no-lock ${RootHost}cli.tsx local`,
                "debug": `deno run -A --no-lock ${RootHost}cli.tsx debug`,
                "serve": `deno run -A --no-lock ${RootHost}cli.tsx serve`,
                "cloud": `deno run -A --no-lock ${RootHost}cli.tsx cloud`        
            };
            const confTasks = (config.json.tasks || {}) as Record<string, string>;
            config.json.tasks = {...confTasks, ...tasks};

            const options = 
            {
                "lib": ["deno.window", "dom", "dom.asynciterable"],
                "jsx": "react-jsx",
                "jsxImportSource": "react"
            }
            const compOpts = config.json.compilerOptions as Record<string, string|string[]> || {};
            const compLib:string[] = compOpts.lib as string[] || [];
            compOpts.jsx = options.jsx;
            compOpts.jsxImportSource = options.jsxImportSource;
            compOpts.lib = [...compLib, ...options.lib];
            config.json.compilerOptions = compOpts;

            await bake(imports);
            await bake(config);
        }
    }
    catch(e)
    {
        console.log(e, "\n (Able Exiting...)");
        Deno.exit();
    }
    console.log(`🚗 Good to go!`);

}