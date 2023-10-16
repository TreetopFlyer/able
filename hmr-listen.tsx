import { HMR } from "./hmr-react.tsx";
import { recordEntrySwap, recordIndexReset } from "./hmr-signal.tsx";

const FileListeners = new Map() as Map<string, Array<(module:unknown)=>void>>;
export const FileListen =(inPath:string, inHandler:()=>void)=>
{
    const members = FileListeners.get(inPath)??[];
    members.push(inHandler);
    FileListeners.set(inPath, members);
};

const Socket:WebSocket = new WebSocket("ws://"+document.location.host);
Socket.addEventListener('message', async(event:{data:string})=>
{
    // When a file changes, dynamically re-import it to get the updated members
    // send the updated members to any listeners for that file

    recordIndexReset();

    const reImport = await import(document.location.origin+event.data+"?reload="+Math.random());
    FileListeners.get(event.data)?.forEach(reExport=>reExport(reImport));

    recordEntrySwap();
    HMR.update();

});
Socket.addEventListener("error", ()=>{clearInterval(SocketTimer); console.log("HMR socket lost")})
const SocketTimer = setInterval(()=>{Socket.send("ping")}, 5000);