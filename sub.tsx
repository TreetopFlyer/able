import { parse } from "https://deno.land/std@0.194.0/flags/mod.ts";

let arg = parse(Deno.args);

console.log(arg);

console.log(Deno.env.get("super"))
