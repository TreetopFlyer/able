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
    ).then(HMR.update);
});
let SocketReloads = 0;
// heartbeat
const SocketTimer = setInterval(()=>{Socket.send("ping")}, 5000);

const HMR = {
    reloads:0,
    registered: new Map() as Map<string, ()=>void>,
    states: new Map(),
    statesOld: new Map(),
    wireframe: false,
    onChange(key:string, value:()=>void):void
    {
        this.registered.set(key, value);
    },
    update()
    {
        this.reloads++;
        this.registered.forEach(handler=>handler());
        this.registered.clear();
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

export const MapAt =(inMap, inIndex)=>
{
    let index = 0;
    for(const kvp of inMap)
    {
        if(index == inIndex)
        {
            return kvp;
        }
        index++;
    }
    return false;
};