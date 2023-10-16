import * as ReactParts from "react-original";

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
export const HMR =
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


export type StateType = boolean|number|string|Record<string, string>
export type StateCapture = {state:StateType, set:ReactParts.StateUpdater<StateType>, reload:number};
type FuncArgs = [element:keyof ReactParts.JSX.IntrinsicElements, props:Record<string, string>, children:ReactParts.JSX.Element[]];


const H = ReactParts.createElement;
const MapIndex =(inMap:Map<string, StateCapture>, inIndex:number)=>
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

const ProxyCreate =(...args:FuncArgs)=> (typeof args[0] == "string")  ?  H(...args)  :  H(ProxyElement, {__args:args, ...args[1]});

const ProxyElement = (props:{__args:FuncArgs})=>
{
    const [stateGet, stateSet] = ReactParts.useState(0);
    const id = ReactParts.useId();
    HMR.RegisterComponent(id, ()=>stateSet(stateGet+1));

    const child = H(...props.__args);

    if(HMR.wireframe)
    {
        return H("div", {style:{padding:"10px", border:"2px solid red"}},
            H("p", null, stateGet),
            child
        );
    }
    else
    {
        return child;        
    }
};

const ProxyState =(argNew:StateType)=>
{
    // does statesOld have an entry for this state? use that instead of the passed arg
    const check =  MapIndex(HMR.statesOld, HMR.statesNew.size);
    const argOld = check ? check[1].state : argNew;

    const id = ReactParts.useId();
    const [stateGet, stateSet] = ReactParts.useState(argOld);

    // state updates due to clicks, interactivity, etc. since the last reload may already be in statesNew for this slot.
    // DONT overwrite it.
    if(!HMR.statesNew.get(id))
    {
        HMR.statesNew.set(id, {state:stateGet, set:stateSet, reload:HMR.reloads});
    }

    const lastKnowReloads = HMR.reloads;
    ReactParts.useEffect(()=>{
        return ()=>{
            if(HMR.reloads == lastKnowReloads)/*i have no idea what this does. this may have to be re-introduced when routing is added*/
            {
                // this is a switch/ui change, not a HMR reload change
                const oldState = MapIndex(HMR.statesOld, HMR.statesNew.size-1);
                oldState && HMR.statesOld.set(oldState[0], {...oldState[1], state:argNew});
            }

            HMR.statesNew.delete(id);
        }
    }, []);


    // do we need to account for the function set?
    function proxySetter ( inArg:StateType|((old:StateType)=>StateType) )
    {   
        const stateUser = {state:inArg as StateType, set:stateSet, reload:HMR.reloads};
        if(typeof inArg == "function")
        {
            //const passedFunction = inArg;
            stateSet((oldState:StateType)=>
            {
                const output = inArg(oldState);
                stateUser.state = output;
                HMR.statesNew.set(id, stateUser);
                return output;
            });
        }
        else
        {
            HMR.statesNew.set(id, stateUser);
            stateSet(inArg);            
        }
    }
    return [stateGet, proxySetter];

};

type Storelike = Record<string, string>
const ProxyReducer =(inReducer:(inState:Storelike, inAction:string)=>Storelike, inState:Storelike, inInit?:(inState:Storelike)=>Storelike)=>
{
    const check =  MapIndex(HMR.statesOld, HMR.statesNew.size);
    const argOld = check ? check[1].state : (inInit ? inInit(inState) : inState);

    const intercept =(inInterceptState:Storelike, inInterceptAction:string)=>
    {
        const capture = inReducer(inInterceptState, inInterceptAction);
        const stateUser = {state:capture, set:()=>{}, reload:HMR.reloads};
        HMR.statesNew.set(id, stateUser);
        return capture;
    };

    const id = ReactParts.useId();
    const [state, dispatch] = ReactParts.useReducer(intercept, argOld as Storelike);

    if(!HMR.statesNew.get(id))
    {
        HMR.statesNew.set(id, {state:state, set:()=>{}, reload:HMR.reloads});
    }

    return [state, dispatch];
};

export * from "react-original";
export {ProxyCreate as createElement, ProxyState as useState, ProxyReducer as useReducer };
export default {...ReactParts, createElement:ProxyCreate, useState:ProxyState, useReducer:ProxyReducer};