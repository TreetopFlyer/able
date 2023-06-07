import * as HTTP from "https://deno.land/std@0.177.0/http/server.ts";
import Setup, {Transpile} from "./serve.tsx";

const Directory = `file://${Deno.cwd().replaceAll("\\", "/")}`;
Transpile.Config.sourceMaps = "inline";
Setup({Proxy:Directory});

const SocketsLive:Set<WebSocket> = new Set();
const SocketsSend =(inData:string)=>{ console.log(inData); for (const socket of SocketsLive){ socket.send(inData); } }
HTTP.serve((_req:Request)=>
{
    if(_req.headers.get("upgrade") == "websocket")
    {
        try
        {
          const { response, socket } = Deno.upgradeWebSocket(_req);
          socket.onopen = () => SocketsLive.add(socket);
          socket.onclose = () => SocketsLive.delete(socket);
          socket.onmessage = (e) => {};
          socket.onerror = (e) => console.log("Socket errored:", e);
          return response;
        }
        catch(e)
        {
            return new Response(e);
        }
    }
    return new Response(`websockets only`);
}, { port: 4444 });

let blocking = false;
const filesChanged:Map<string, string> = new Map();
for await (const event of Deno.watchFs(Deno.cwd()))
{
    event.paths.forEach( path => filesChanged.set(path, event.kind) );
    if(!blocking)
    {
        blocking = true;
        setTimeout(async()=>
        {
            for await (const [path, action] of filesChanged)
            {
                const key = path.substring(Deno.cwd().length).replaceAll("\\", "/");
                if(action != "remove")
                {   
                    const tsx = await Transpile.Fetch(Directory+key, key, true);
                    tsx && SocketsSend(key);
                }
                else
                {
                    Transpile.Cache.delete(key);
                }
            }
            filesChanged.clear();
            blocking = false;
        }
        , 1000);
    }
}
