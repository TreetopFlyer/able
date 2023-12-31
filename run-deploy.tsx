import * as Env from "https://deno.land/std@0.194.0/dotenv/mod.ts";
import { parse } from "https://deno.land/std@0.194.0/flags/mod.ts";


const collect =async(inKey:string, inArg:Record<string, string>, inEnv:Record<string, string>):Promise<string|undefined>=>
{
    const scanArg = inArg[inKey];
    const scanEnvFile = inEnv[inKey];
    const scanEnvDeno = Deno.env.get(inKey);

    if(scanArg)
    {
        console.log(`Using "${inKey}" from passed argument.`);
        return scanArg;
    }
    if(scanEnvFile)
    {
        console.log(`Using "${inKey}" from .env file.`);
        return scanEnvFile;
    }
    if(scanEnvDeno)
    {
        console.log(`Using "${inKey}" from environment variable.`);
        return scanEnvDeno;
    }

    const scanUser = await prompt(`No "${inKey}" found. Enter one here:`);
    if(!scanUser || scanUser?.length < 3)
    {
        console.log("Exiting...");
        Deno.exit();
    }
    return scanUser;
};

const prompt =async(question: string):Promise<string>=>
{
    const buf = new Uint8Array(1024);
    await Deno.stdout.write(new TextEncoder().encode(question));
    const bytes = await Deno.stdin.read(buf);
    if (bytes) {
        return new TextDecoder().decode(buf.subarray(0, bytes)).trim();
    }
    throw new Error("Unexpected end of input");
};

try
{
    console.log("Runing deploy!", Deno.mainModule);

    let arg = parse(Deno.args);
    let env = await Env.load();

    let useToken = await collect("DENO_DEPLOY_TOKEN", arg, env);
    let useProject = await collect("DENO_DEPLOY_PROJECT", arg, env);
    
    let scanProd:string|string[] = await prompt(`Do you want to deploy to *production*? [y/n]`);
    if(scanProd == "y")
    {
        scanProd = await prompt(`This will update the live project at ${useProject} are you sure you want to continue? [y/n]`);
        scanProd = scanProd=="y" ? ["--prod"] : [];
    }
    else
    {
        scanProd = [];
    }

    const command = new Deno.Command(
        `deno`,
        {
            args:[
                "run",
                "-A",
                "--no-lock",
                "https://deno.land/x/deploy/deployctl.ts",
                "deploy",
                `--project=${useProject}`,
                `--import-map=./deno.json`,
                `--token=${useToken}`,
                ...scanProd,
                Deno.mainModule
            ],
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
catch(e)
{
    console.error(e);
}