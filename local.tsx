import {Configure, Transpile, Extension} from "./serve.tsx";

const SocketsLive:Set<WebSocket> = new Set();
const SocketsSend =(inData:string)=>{ console.log(inData); for (const socket of SocketsLive){ socket.send(inData); } }
const Directory = `file://${Deno.cwd().replaceAll("\\", "/")}`;

Configure({
    Proxy:Directory,
    SWCOp:
    {
        sourceMaps: "inline",
        minify: false,
        jsc:
        {
            target:"es2022",
            parser:
            {
                syntax: "typescript",
                tsx: true,
            }
        }
    },
    
    Serve(inReq, inURL, inExt, inMap)
    {
        if(inReq.headers.get("upgrade") == "websocket")
        {
            try
            {
              const { response, socket } = Deno.upgradeWebSocket(inReq);
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
        else
        {
            return false;
        }
    }
});

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
                if(Transpile.Check(Extension(path)))
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
            }
            filesChanged.clear();
            blocking = false;
        }
        , 1000);
    }
}
