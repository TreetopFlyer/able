import { parse as JSONC } from "https://deno.land/x/jsonct@v0.1.0/mod.ts";
const RootFile = new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString();
const RootHost = import.meta.resolve("./");

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
                    resp = await fetch(RootFile + "/" + path);
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
            // malformed json
        }
    }

    return {path, text, json};
}

export async function HuntImport()
{

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

const config = await HuntConfig();
if(!config.path)
{
    const pathServer = import.meta.resolve("./");
    try
    {
        const resp1 = await Prompt("No Deno configuration found. Create one? [y/n]");
        if(resp1 == "y")
        {
            const resp2 = await Prompt("Do you also want to add starter files? [y/n]");
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

            await Install("deno.jsonc", (s)=>s
                .replace("{{server}}", RootHost)
                .replace("{{app}}", replaceApp)
                .replace("{{api}}", replaceApi)
                .replace("{{commentApp}}", replaceCommentApp)
                .replace("{{commentApi}}", replaceCommentApi)
            );
        }
        else
        {
            throw("Config declined.");
        }
    }
    catch(e)
    {
        console.log(e, "(Exiting...)");
        Deno.exit();
    }
}
else if(config.json)
{

}
console.log(config);