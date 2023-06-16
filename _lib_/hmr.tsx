import { type StateCapture } from "./react.tsx";

type FileHandler = (module:unknown)=>void
const FileListeners = new Map() as Map<string, Array<FileHandler>>;
export const FileListen =(inPath:string, inHandler:()=>void)=>
{
    const members = FileListeners.get(inPath)??[];
    members.push(inHandler);
    FileListeners.set(inPath, members);
};

const Socket:WebSocket = new WebSocket("ws://"+document.location.host);
Socket.addEventListener('message', (event:{data:string})=>
{
    const handlers = FileListeners.get(event.data)??[];
    SocketReloads++;
    Promise.all(
        handlers.map((handler)=>
        {
            return import(event.data+"?reload="+SocketReloads)
            .then(updatedModule=>handler(updatedModule));
        })
    ).then(()=>HMR.update());
});
let SocketReloads = 0;
// heartbeat
const SocketTimer = setInterval(()=>{Socket.send("ping")}, 5000);

const HMR = {
    reloads:0,
    createdElements: new Map() as Map<string, ()=>void>,
    states: new Map() as Map<string, StateCapture>,
    statesOld: new Map() as Map<string, StateCapture>,
    wireframe: false,
    onChange(reactID:string, value:()=>void):void
    {
        this.createdElements.set(reactID, value);
    },
    update()
    {
        this.reloads++;
        this.createdElements.forEach(handler=>handler());
        this.createdElements.clear();
        this.statesOld = this.states;
        this.states = new Map();
        this.echoState();
    },
    echoState()
    {
        let output = [];
        for(const[key, val] of HMR.statesOld)
        {
            output[key] = val.state+"--"+val.reload;
        }
        console.log(output);
        output = [];
        for(const[key, val] of HMR.states)
        {
            output[key] = val.state+"--"+val.reload;
        }
        console.log(output);
    }
};

export {HMR};