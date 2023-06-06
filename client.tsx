import * as HTTP from "https://deno.land/std@0.177.0/http/server.ts";
import * as Transpile from "./xpile.tsx";

const dir = `file://${Deno.cwd().replaceAll("\\", "/")}`;

const Sockets:Set<WebSocket> = new Set();
const SocketsBroadcast =(inData:string)=>{ console.log(inData); for (const socket of Sockets){ socket.send(inData); } }
const SocketsHandler = (_req:Request)=>
{
    if(_req.headers.get("upgrade") == "websocket")
    {
        try
        {
          const { response, socket } = Deno.upgradeWebSocket(_req);
          socket.onopen = () => Sockets.add(socket);
          socket.onclose = () => Sockets.delete(socket);
          socket.onmessage = (e) => {};
          socket.onerror = (e) => console.log("Socket errored:", e);
          return response;
        }
        catch(e)
        {
            //
            return new Response(e);
        }
    }
    return new Response(`websockets only`);
};

HTTP.serve(SocketsHandler, { port: 4444 });

const watcher =async()=>
{
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
                        await Transpile.Fetch(dir+key, key, true);
                        SocketsBroadcast(key);
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
}
watcher().then(()=>console.log("done watching"));