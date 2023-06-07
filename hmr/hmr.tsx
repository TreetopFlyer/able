
let reloads = 0;
const listeners = new Map() as Map<string, Array<(module:unknown)=>void>>;
const socket:WebSocket = new WebSocket("ws://"+document.location.host);
socket.addEventListener('message', (event) =>
{
    let handlers = listeners.get(event.data)??[];
    reloads++;
    Promise.all(
        handlers.map(handler=>
        {
            return import(event.data+"?reload="+reloads)
            .then(updatedModule=>handler(updatedModule));
        })
    ).then(()=>HMR.update());
});
const socketTimer = setInterval(()=>{socket.send("ping")}, 1000);

export const FileListen =(inPath:string, inHandler:()=>void)=>
{
    const members = listeners.get(inPath)??[];
    members.push(inHandler);
    listeners.set(inPath, members);
};

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