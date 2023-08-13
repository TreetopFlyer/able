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

    if(text)
    {
        try
        {
            json = JSONC(text);
        }
        catch(e)
        {
            // malformed config
            json = undefined;
        }
    }

    let imports:ConfigCheck = {};
    if(json && json.imports)
    {
        imports.json = json;
        imports.text = JSON.stringify(json);
        imports.path = path;
    }
    else if(json && !json.imports && json.importMap)
    {
        try
        {
            imports.path = json.importMap;
            resp = await fetch(Root + "/" + imports.path);
            imports.text = await resp.text();
            imports.json = JSONC(text);
        }
        catch(e)
        {
            // malformed import map
        }
    }

    return [{path, text, json}, imports] as ConfigCheckPair
}

export async function Install(file:string, handler:(content:string)=>string = (s)=>s)
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
        await Deno.writeTextFile(Deno.cwd()+"/"+file, handler(text));   
    }
}



export async function Check()
{
    console.info(`👷 Checking your project`);
    try
    {
        let [config, imports] = await HuntConfig();
        if(!config.path)
        {
            if(confirm("🚨🚧 No Deno configuration found. Create a new one?"))
            {
                await Install("deno.jsonc");

                Check();
                return;
            }
            else
            {
                throw("⛔ Configuration is required.");
            }
        }
        
        else if(!imports.json || !imports.json?.imports)
        {
            const resp = confirm(`🚨🔧 Configuration found, but has no import map. Fix it now?`);
            if(resp)
            {
                const text = config.text||"";
                const startBracket = text.indexOf("{");

                config.text = `{
    "imports": {}${startBracket < 0 ? "\n}\n" : ",\n"}` + text.substring(startBracket+1);
                
                await Deno.writeTextFile(Deno.cwd()+"/"+config.path, config.text); 

                Check();
                return;

            }
            else
            {
                throw("⛔ Import maps are required.");
            }
        }

        if(config.json && imports.text && imports.json?.imports)
        {
            const importMap = imports.json.imports as Record<string, string>;
            let changes = ``;

            const match = imports.text.search(/(?<=(['"`])imports\1[^{}]*{)/);
            const part1 = imports.text.substring(0, match);
            const part2 = imports.text.substring(match);

            const bake =async()=> await Deno.writeTextFile(Deno.cwd()+"/"+config.path, part1 + changes + part2); 

            if(!importMap["react"])
            {
                const resp = confirm(`🚨🔧 Import map has no specifier for React ("react"). Fix it now? (Will use Preact compat)`);
                if(resp)
                {
                    changes += `"react": "https://esm.sh/preact@10.16.0/compat",\n`;
                    if(!importMap["react/"])
                    {
                        changes += `"react/": "https://esm.sh/preact@10.16.0/compat/",\n`;
                    }
                    await bake(); 
                }
                else
                {
                    throw(`⛔ A React import ("react") is required.`);
                }
            }
            if(!importMap[">able/"])
            {
                const resp = confirm(`🚨🔧 Import map has no specifier for Able (">able/"). Fix it now?`);
                if(resp)
                {
                    changes += `">able/": "${RootHost}",\n`;
                    await bake(); 
                }
                else
                {
                    throw(`⛔ The Able import (">able/") is required.`);
                }
            }
            if(!importMap[">able/app.tsx"])
            {
                const resp = confirm(`🚨🔧 Import map has no specifier for your starter app (">able/app.tsx"). Fix it now?`);
                if(resp)
                {
                    changes += `">able/app.tsx": "./app.tsx",\n`;
                    await bake(); 
                    await Install("app.tsx");
                }
                else
                {
                    throw(`⛔ The "starter app" import (">able/app.tsx") is required.`);
                }
            }
            if(!importMap[">able/api.tsx"])
            {
                const resp = confirm(`🚨🔧 OPTIONAL: Import map has no specifier for your backend app (">able/api.tsx"). Fix it now?`);
                if(resp)
                {
                    changes += `">able/api.tsx": "./api.tsx",\n`;
                    await bake(); 
                    await Install("api.tsx");
                }
            }


            const compOpts = imports.json.compilerOptions as Record<string, string>;
            if(compOpts)
            {
                const compJSX = compOpts["jsx"];
                const compJSXImportSource = compOpts["jsxImportSource"]
                if(compJSX || compJSXImportSource)
                {
                    if(!importMap["react/"])
                    {
                        //const resp = await Prompt(` ! Import map has no specifier for React ("react"). Add it now? [y/n]`);
                    }
                }            
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