import { parse as JSONC } from "https://deno.land/x/jsonct@v0.1.0/mod.ts";
const RootFile = new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString();
const RootHost = import.meta.resolve("./");

type ConfigCheck = {path?:string, text?:string, json?:Record<string, string|Record<string, string|string[]>>};
type ConfigCheckPair = [config:ConfigCheck, imports:ConfigCheck];

export async function HuntConfig()
{
    let path:string, resp:Response, text="", json;
    try
    {
        path = "deno.json"
        resp = await fetch(RootFile + "/" + path);
        text = await resp.text();
    }
    catch(e)
    {
        try
        {
            path = "deno.jsonc";
            resp = await fetch(RootFile + "/" + path);
            text = await resp.text();
        }
        catch(e)
        {
            try
            {
                path = RootFile+"/.vscode/settings.json"
                resp = await fetch(path);
                json = await resp.json();
                path = json["deno.config"];
                json = undefined;
                if(path)
                {
                    path = RootFile + "/" + path
                    resp = await fetch(path);
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
        }
    }

    let imports:ConfigCheck = {};
    if(json && json.imports)
    {
        imports.json = json;
        imports.text = JSON.stringify(json.imports);
        imports.path = path;
    }
    else if(json && !json.imports && json.importMap)
    {
        try
        {
            imports.path = RootFile + "/" + json.importMap;
            resp = await fetch(imports.path);
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

export async function SubProcess(args:string[])
{
    const command = new Deno.Command(
        `deno`,
        {
            args,
            stdin: "piped",
            stdout: "piped"
        }
    );

    const child = command.spawn();

    // open a file and pipe the subprocess output to it.
    const writableStream = new WritableStream({
        write(chunk: Uint8Array): Promise<void> {
            Deno.stdout.write(chunk);
            return Promise.resolve();
        },
    });
    child.stdout.pipeTo(writableStream);

    // manually close stdin
    child.stdin.close();
    const status = await child.status;    
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

console.info(`👷 Checking your project`)
try
{
    let [config, imports] = await HuntConfig();
    if(!config.path)
    {
        //const resp1 = await Prompt(" ! No Deno configuration found. Create one? [y/n]");
        const resp1 = confirm("🚨🚧 No Deno configuration found. Create one?");
        if(resp1)
        {
            const resp2 = confirm("⚠️🚧 Do you also want to add starter files?");
            let replaceApp = "./path/to/app.tsx";
            let replaceApi = "./path/to/api.tsx";
            let replaceCommentApp = "// (required) module with default export ()=>React.JSX.Element";
            let replaceCommentApi = "// (optional) module with default export (req:Request, url:URL)=>Promise<Response|false>";
            if(resp2)
            {
                replaceApp = "./app.tsx";
                replaceApi = "./api.tsx";
                replaceCommentApp = "";
                replaceCommentApi = "";

                await Install("app.tsx");
                await Install("api.tsx");
            }
            else
            {
                // config initialized with no app or api
            }

            await Install("deno.jsonc", (s)=>s
                .replace("{{server}}", RootHost)
                .replace("{{app}}", replaceApp)
                .replace("{{api}}", replaceApi)
                .replace("{{commentApp}}", replaceCommentApp)
                .replace("{{commentApi}}", replaceCommentApi)
            );

            [config, imports] = await HuntConfig();
        }
        else
        {
            throw("⛔ Config is required.");
        }

    }

/*
const inputString = `Some text 'imports' more text { some content }`;
const regex = /(?<=(['"`])imports\1[^{}]*{)/;

const match = inputString.search(regex);

if (match !== -1) {
  console.log("Index of '{':", match);
} else {
  console.log("'{': Not found.");
}
*/

    if(config.json && imports.json?.imports)
    {
        const importMap = imports.json.imports as Record<string, string>;
        let changes = ``;
        if(!importMap["react"])
        {
            const resp = confirm(`🚨🔧 Import map has no specifier for React ("react"). Fix it now? (Will use Preact compat)`);
            if(resp)
            {
                importMap["react"] =  "https://esm.sh/preact@10.16.0/compat";
                changes += `"react": "https://esm.sh/preact@10.16.0/compat",\n`;
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
                importMap[">able/"] =  RootHost;
                changes += `">able": "${RootHost}",\n`;
            }
            else
            {
                throw(`⛔ The Able import (">able/") is required.`);
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
