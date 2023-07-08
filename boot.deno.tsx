import "./run-serve.tsx";

if(Deno.env.get("dev"))
{
  await import("./run-local.tsx");
}