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

async function Prompt(question: string):Promise<string>
{
    const buf = new Uint8Array(1024);
    await Deno.stdout.write(new TextEncoder().encode(question));
    const bytes = await Deno.stdin.read(buf);
    if (bytes) {
        return new TextDecoder().decode(buf.subarray(0, bytes)).trim();
    }
    throw new Error("Unexpected end of input");
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
        const replace = await Prompt(`The file "${file}" already exists. Replace it? [y/n]`);
        if(replace == "y")
        {
            throw("")
        }
        console.log(`Skipping "${file}" for now.`);
    }
    catch(e)
    {
        const resp = await fetch(pathFile);
        const text = await resp.text();
        await Deno.writeTextFile(Deno.cwd()+"/"+file, handler(text));   
    }
}

try
{
    let [config, imports] = await HuntConfig();
    console.log(`1) Checking for Deno configuration...`)
    if(!config.path)
    {
        const resp1 = await Prompt(" ! No Deno configuration found. Create one? [y/n]");
        if(resp1 == "y")
        {
            const resp2 = await Prompt(" ? Do you also want to add starter files? [y/n]");
            let replaceApp = "./path/to/app.tsx";
            let replaceApi = "./path/to/api.tsx";
            let replaceCommentApp = "// (required) module with default export ()=>React.JSX.Element";
            let replaceCommentApi = "// (optional) module with default export (req:Request, url:URL)=>Promise<Response|false>";
            if(resp2 == "y")
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
            throw(" X  Config is required.");
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

    console.log(`2) Verifying configuration...`)
    if(config.json && imports.json?.imports)
    {
        const importMap = imports.json.imports as Record<string, string>;
        let changes = false;
        if(!importMap["react"])
        {
            const resp = await Prompt(` ! Import map has no specifier for React. Add it now? (will use Preact compat) [y/n]`);
            if(resp == "y")
            {
                importMap["react"] =  "https://esm.sh/preact@10.16.0/compat";
                changes = true;
            }
            else
            {
                throw(" X  A React import is required.");
            }
        }
        if(!importMap[">able/"])
        {
            const resp = await Prompt(` ! Import map has no specifier for Able (">able/"). Add it now? [y/n]`);
            if(resp == "y")
            {
                importMap[">able/"] =  RootHost;
                changes = true;
            }
            else
            {
                throw(" X  Able is required.");
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
