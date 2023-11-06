import * as Serve from "./run-serve.tsx";

Deno.args.forEach(arg=>
{
    if(arg.startsWith("--"))
    {
        const kvp = arg.substring(2).split("=");
        Deno.env.set(kvp[0], kvp[1] || "true");
    }
});
const isDeploy = Deno.env.get("dep");
const isDevelop = Deno.env.get("dev");

export default function(config:Serve.ConfigurationArgs)
{
    if(!isDeploy)
    {
        Serve.Configure(config)
        Serve.default();
    }
}

if(isDevelop)
{
    await import("./run-local.tsx");
}
Serve.default();