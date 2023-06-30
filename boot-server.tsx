import "./run-serve.tsx";

Deno.args.forEach(arg=>
{
    if(arg.startsWith("--"))
    {
        const kvp = arg.substring(2).split("=");
        Deno.env.set(kvp[0], kvp[1] || "true");
    }
});

if(Deno.env.get("dev"))
{
  await import("./run-local.tsx");
}