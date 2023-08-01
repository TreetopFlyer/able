import { parse as JSONC } from "https://deno.land/x/jsonct@v0.1.0/mod.ts";

export async function HuntConfig()
{
    const Root = new URL(`file://${Deno.cwd().replaceAll("\\", "/")}`).toString();
    let path:string, resp:Response, text="", json;
    try
    {
        path = "./deno.json"
        resp = await fetch(Root + "/" + path);
        text = await resp.text();
    }
    catch(e)
    {
        try
        {
            path = "./deno.jsonc";
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

    return {text, path, json};
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

const conf = await HuntConfig();
console.log(conf);