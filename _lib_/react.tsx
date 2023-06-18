import * as ReactParts from "react-original";
import { HMR } from "./hmr.tsx";

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


const ProxyCreate =(...args:FuncArgs)=>
{
    if(typeof args[0] == "string")
    {
        return H(...args)
    }
    else
    {
        return H(ProxyElement, {__args:args, ...args[1]});        
    }
};

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


const ProxyState =(arg:StateType)=>
{
    const id = ReactParts.useId();
    //const argOriginal = arg;
    // does statesOld have an entry for this state? use that instead of the passed arg
    const check =  MapIndex(HMR.statesOld, HMR.statesNew.size);
    const argOld = check ? check[1].state : arg;

    const lastKnowReloads = HMR.reloads;
    const [stateGet, stateSet] = ReactParts.useState(argOld);
    ReactParts.useEffect(()=>{

        

        /*
        i have no idea what this does
        return ()=>{
            if(HMR.reloads == lastKnowReloads)
            {
                // this is a switch/ui change, not a HMR reload change
                const oldState = MapIndex(HMR.statesOld, HMR.statesNew.size-1);
                oldState && HMR.statesOld.set(oldState[0], {...oldState[1], state:arg});

                console.log("check: ui-invoked")
            }
            else
            {
                console.log("check: hmr-invoked")
            }
            HMR.statesNew.delete(id);
        }
        */
    }, []);

    if(!HMR.statesNew.has(id))
    {
        HMR.statesNew.set(id, {state:argOld, set:stateSet, reload:HMR.reloads});
    }
    
    function proxySetter (inArg:StateType)
    {
        //console.log("state spy update", id, arg);
        HMR.statesNew.set(id, {state:inArg, set:stateSet, reload:HMR.reloads});
        return stateSet(inArg);
    }
    return [stateGet, proxySetter];

};

export * from "react-original";
export {ProxyCreate as createElement, ProxyState as useState };
export const isProxy = true;
export default {...ReactParts, createElement:ProxyCreate, useState:ProxyState, isProxy:true};