import * as ReactParts from "react-original";
import { HMR, MapAt } from "./hmr.tsx";

const H = ReactParts.createElement;

const ProxyElement = (props)=>
{
    const id = ReactParts.useId();
    const [stateGet, stateSet] = ReactParts.useState(0);
    ReactParts.useEffect(()=>HMR.onChange(id, ()=>stateSet(stateGet+1)));

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

const ProxyCreate =(...args)=>
{
    return typeof args[0] != "string" ? H(ProxyElement, {__args:args, ...args[1]}) : H(...args);
};

const ProxyState =(arg)=>
{
    const id = ReactParts.useId();
    const trueArg = arg;

    // does statesOld have an entry for this state? use that instead of the passed arg
    const check =  MapAt(HMR.statesOld, HMR.states.size);
    if(check)
    {
        arg = check[1].state;
        console.info(`BOOTING with ${arg}`);
    }

    const lastKnowReloads = HMR.reloads;
    const [stateGet, stateSet] = ReactParts.useState(arg);
    ReactParts.useEffect(()=>{
        return ()=>{
            if(HMR.reloads == lastKnowReloads)
            {
                // this is a switch/ui change, not a HMR reload change
                const oldState = MapAt(HMR.statesOld, HMR.states.size-1);
                HMR.statesOld.set(oldState[0], {...oldState[1], state:trueArg});
            }
            HMR.states.delete(id);
        }
    }, []);

    if(!HMR.states.has(id))
    {
        HMR.states.set(id, {state:arg, set:stateSet, reload:HMR.reloads});
    }
    
    function proxySetter (arg)
    {
        //console.log("state spy update", id, arg);
        HMR.states.set(id, {state:arg, set:stateSet, reload:HMR.reloads});
        return stateSet(arg);
    }
    return [stateGet, proxySetter];

};

export * from "react-original";
export { ProxyCreate as createElement, ProxyState as useState };
export const isProxy = true;
export default {...ReactParts.default, createElement:ProxyCreate, useState:ProxyState, isProxy:true};