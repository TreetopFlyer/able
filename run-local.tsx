import {Configure, Transpile, Extension} from "./run-serve.tsx";

const SocketsLive:Set<WebSocket> = new Set();
const SocketsSend =(inData:string)=>{ for (const socket of SocketsLive){ socket.send(inData); } }

Configure({
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
    Remap: (inImports, inConfig)=>
    {
        inImports["react-original"] = inImports["react"];
        inImports["react"] = `${inConfig.Spoof}/hmr-react.tsx`;
        return inImports;
    },
    async Serve(inReq, inURL, inExt, inMap, inConfig)
    {
        if(Transpile.Check(inExt) && !inURL.searchParams.get("reload") && !inURL.pathname.startsWith(inConfig.Spoof+"/"))
        {
            const imp = await import(inConfig.Proxy+inURL.pathname);
            const members = [];
            for( const key in imp ) { members.push(key); }

            const code =`
import {FileListen} from "${inConfig.Spoof}/hmr-listen.tsx";
import * as Import from "${inURL.pathname}?reload=0";
${ members.map(m=>`let proxy_${m} = Import.${m}; export { proxy_${m} as ${m} };`).join("\n") }
FileListen("${inURL.pathname}", (updatedModule)=>
{
    ${ members.map(m=>`proxy_${m} = updatedModule.${m};`).join("\n") }
});`            

            return new Response(code, {headers:{"content-type":"application/javascript"}});
        }


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
            catch(e){ /**/ }
        }
    }
});

const Watcher =async()=>
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
                    if(Transpile.Check(Extension(path)))
                    {
                        const key = path.substring(Deno.cwd().length).replaceAll("\\", "/");
                        if(action != "remove")
                        {   
                            const tsx = await Transpile.Fetch(`file://${Deno.cwd().replaceAll("\\", "/")}`+key, key, true);
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
}

Watcher();