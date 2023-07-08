import { type StateCapture } from "./hmr-react.tsx";

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
    const reImport = await import(document.location.origin+event.data+"?reload="+Math.random());
    FileListeners.get(event.data)?.forEach(reExport=>reExport(reImport));
    HMR.update();
});
Socket.addEventListener("error", ()=>{clearInterval(SocketTimer); console.log("HMR socket lost")})
const SocketTimer = setInterval(()=>{Socket.send("ping")}, 5000);

/*

Each custom component is secretly modified to have an extra state and id.
When there is an HMR update, this state is changed, forcing it to re-render.

Each *user-created* React.useState is secretly modified and accompanied by an ID.
Every time its state is set, the HMR.statesNew map for this ID is set to contain the new state and updater.
When a component is removed, any of it's states in HMR.statesNew are also removed. 
(HMR.statesNew is the "running total" of all states currently at play).

---

When a state is interacted with:
- statesNew for this id is set
- the internal state is also set in the traditional way

When there is an HMR update:
- All custom components are re-rendered...
  for each useState(value) call that then happens in the re-render:
  - if there is a "statesOld" value for this state, use that and ignore the passed value, otherwise use the passed value
  - if this state has not been interacted with since the last reload (statesNew is empty at this id), set statesNew<id> with whatever is in statesOld<id>
- statesNew is moved into *statesOld*
- statesNew is cleared.

*/

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