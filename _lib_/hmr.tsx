import { type StateCapture } from "./react.tsx";


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
    const reImport = await import(event.data+"?reload="+HMR.reloads);
    const handlers = FileListeners.get(event.data)??[];
    handlers.forEach(handler=>handler(reImport));
    HMR.update();
});
Socket.addEventListener("error", ()=>{clearInterval(SocketTimer); console.log("HMR socket lost")})
const SocketTimer = setInterval(()=>{Socket.send("ping")}, 5000);

const HMR =
{
    reloads:1,
    RegisteredComponents: new Map() as Map<string, ()=>void>,
    statesNew: new Map() as Map<string, StateCapture>,
    statesOld: new Map() as Map<string, StateCapture>,
    wireframe: false,
    RegisterComponent(reactID:string, value:()=>void):void
    {
        this.RegisteredComponents.set(reactID, value);
    },
    update()
    {
        this.reloads++;
        this.RegisteredComponents.forEach(handler=>handler());
        this.RegisteredComponents.clear();
        this.statesOld = this.statesNew;
        this.statesNew = new Map();
    }
};

export {HMR};