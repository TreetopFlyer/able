import * as MIME from "https://deno.land/std@0.180.0/media_types/mod.ts";
import * as HTTP from "https://deno.land/std@0.177.0/http/server.ts";
import * as Transpile from "./xpile.tsx";

type Configuration = {Proxy:string, Allow:string, Reset:string, Local:boolean};
type ConfigurationArgs = {Proxy?:string, Allow?:string, Reset?:string, Local?:boolean};

let Configure:Configuration =
{
    Proxy: "",
    Allow: "*",
    Reset: "/clear-cache",
    Local: false
};
export default (config:ConfigurationArgs)=> Configure = {...Configure, ...config};


HTTP.serve(async(req: Request)=>
{
    const url:URL = new URL(req.url);

    if(url.pathname === Configure.Reset)
    {
        return new Response(`cache cleared (${Transpile.Clear()} items)`);
    }

    const lookup = await Transpile.Fetch(Configure.Proxy + url.pathname);
    if(lookup === null)
    {
        // error
        return new Response(`transpile error (see console)`, {status:404, headers:{"content-type":"application/javascript", "Access-Control-Allow-Origin": Configure.Allow, charset:"utf-8"}});
    }
    else if(lookup === false)
    {
        // not a javascript file
        const type = MIME.typeByExtension(url.pathname.substring(url.pathname.lastIndexOf("."))) || "text/html";
        const file = await fetch(Configure.Proxy + url.pathname);
        const text = await file.text();
        return new Response(text, {headers:{"content-type":type, "Access-Control-Allow-Origin":Configure.Allow, charset:"utf-8"}});
    }
    else
    {
        return new Response(lookup, {headers:{"content-type":"application/javascript", "Access-Control-Allow-Origin": Configure.Allow, charset:"utf-8"}});
    }
});