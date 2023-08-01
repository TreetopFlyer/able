import { parse as JSONC } from "https://deno.land/x/jsonct@v0.1.0/mod.ts";
const Root = new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString();
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
                path = Root+"/.vscode/settings.json"
                resp = await fetch(path);
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
            // malformed json
        }
    }

    return {path, text, json};
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

const config = await HuntConfig();
if(!config.path)
{
    try
    {
        const resp = await Prompt("No Deno configuration found. Create one? [y/n]");
        if(resp == "y")
        {
            const pathServer = import.meta.resolve("./");
            const pathConfig = pathServer + "install__/deno.jsonc";

            console.log(pathServer, pathConfig);

            const resp = await fetch(pathConfig);
            const text = await resp.text();
            Deno.writeTextFileSync(Deno.cwd()+"/deno.jsonc", text.replaceAll("{{server}}", pathServer));
        }
        else
        {
            throw("");
        }
    }
    catch(e)
    {
        console.log(e, "(Exiting...)");
        Deno.exit();
    }
}
console.log(config);