import * as Serve from "./run-serve.tsx";

export default function(config:Serve.ConfigurationArgs)
{
    if(Deno.env.get("deploy"))
    {
        return;
    }
    Serve.Configure(config)
    Serve.default();
}

Deno.args.forEach(arg=>
{
    if(arg.startsWith("--"))
    {
        const kvp = arg.substring(2).split("=");
        Deno.env.set(kvp[0], kvp[1] || "true");
    }
});

if(Deno.env.get("dep"))
{
    import("./run-deploy.tsx");
}
else
{
    if(Deno.env.get("dev"))
    {
        await import("./run-local.tsx");
    }
    Serve.default();
}