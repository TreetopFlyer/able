import * as Env from "https://deno.land/std@0.194.0/dotenv/mod.ts";
import * as Arg from "https://deno.land/std@0.194.0/flags/mod.ts";

let arg = Arg.parse(Deno.args);
let env = await Env.load();

Deno.env.set("super", "its super");

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


SubProcess(["run", "-A", "sub.tsx", "keyword!", "--passed=yep"]);