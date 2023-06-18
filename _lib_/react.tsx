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
                console.log("check: ui-invoked")
            }

            HMR.statesNew.delete(id);
        }
    }, []);


    // do we need to account for the function set?
    function proxySetter (inArg:StateType)
    {
        const stateUser = {state:inArg, set:stateSet, reload:HMR.reloads};
        HMR.statesNew.set(id, stateUser);
        stateSet(inArg);
    }
    return [stateGet, proxySetter];

};

export * from "react-original";
export {ProxyCreate as createElement, ProxyState as useState };
export const isProxy = true;
export default {...ReactParts, createElement:ProxyCreate, useState:ProxyState, isProxy:true};