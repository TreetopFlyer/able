import * as ReactParts from "react-original";
import { HMR } from "./hmr.tsx";

export type StateType = boolean|number|string|Record<string, string>
export type StateCapture = {state:StateType, set:ReactParts.StateUpdater<StateType>, reload:number};
type FuncArgs = [element:keyof ReactParts.JSX.IntrinsicElements, props:Record<string, string>, children:ReactParts.JSX.Element[]];

const H = ReactParts.createElement;
const MapAt =(inMap:Map<string, StateCapture>, inIndex:number)=>
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

    // does statesOld have an entry for this state? use that instead of the passed arg
    const check =  MapAt(HMR.statesOld, HMR.statesNew.size);

    const lastKnowReloads = HMR.reloads;
    const [stateGet, stateSet] = ReactParts.useState(check ? check[1].state : arg);
    ReactParts.useEffect(()=>{
        return ()=>{
            if(HMR.reloads == lastKnowReloads)
            {
                // this is a switch/ui change, not a HMR reload change
                const oldState = MapAt(HMR.statesOld, HMR.statesNew.size-1);
                oldState && HMR.statesOld.set(oldState[0], {...oldState[1], state:arg});

                console.log("check: ui-invoked")
            }
            else
            {
                console.log("check: hmr-invoked")
            }
            HMR.statesNew.delete(id);
        }
    }, []);

    if(!HMR.statesNew.has(id))
    {
        HMR.statesNew.set(id, {state:arg, set:stateSet, reload:HMR.reloads});
    }
    
    function proxySetter (arg:StateType)
    {
        //console.log("state spy update", id, arg);
        HMR.statesNew.set(id, {state:arg, set:stateSet, reload:HMR.reloads});
        return stateSet(arg);
    }
    return [stateGet, proxySetter];

};

export * from "react-original";
export {ProxyCreate as createElement, ProxyState as useState };
export const isProxy = true;
export default {...ReactParts, createElement:ProxyCreate, useState:ProxyState, isProxy:true};