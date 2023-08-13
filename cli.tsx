import * as Env from "https://deno.land/std@0.194.0/dotenv/mod.ts";
import * as Arg from "https://deno.land/std@0.194.0/flags/mod.ts";
import { RootHost, HuntConfig, Install, Check } from "./checker.tsx";

let arg = await Arg.parse(Deno.args);
let env = await Env.load();
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

    const scanUser = prompt(`No "${inKey}" found. Enter one here:`);
    if(!scanUser || scanUser?.length < 3)
    {
        console.log("Exiting...");
        Deno.exit();
    }
    return scanUser;
};


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

if(arg._.length)
{

    const [config, imports] = await HuntConfig();

    switch(arg._[0])
    {
        case "work" :
        {
            await SubProcess(["run", `--config=${config.path}`, RootHost+"run.tsx", "--dev", ...Deno.args]);
        }
        case "host" :
        {
            await SubProcess(["run", `--config=${config.path}`, RootHost+"run.tsx", ...Deno.args]);
        }
        case "push" :
        {
            let useToken = await collect("DENO_DEPLOY_TOKEN", arg, env);
            let useProject = await collect("DENO_DEPLOY_PROJECT", arg, env);
            
            let scanProd:string[]|string|null = prompt(`Do you want to deploy to *production*?`);
            if(scanProd)
            {
                scanProd = prompt(`Are you sure? This will update the live project at "${useProject}"`);
                scanProd = scanProd ? ["--prod"] : [];
            }
            else
            {
                scanProd = [];
            }

            await SubProcess([
                "run",
                "-A",
                "--no-lock",
                `--config=${config.path}`,
                "https://deno.land/x/deploy/deployctl.ts",
                "deploy",
                `--project=${useProject}`,
                `--token=${useToken}`,
                `--import-map=${imports.path}`,
                RootHost+"run.tsx",
                ...scanProd,
                ...Deno.args]);
        }
    }
}