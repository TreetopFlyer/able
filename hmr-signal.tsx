import * as SignalsParts from "signals-original";

type Entry = [signal:SignalsParts.Signal<unknown>, initArg:unknown];

let recordEntry:Entry[] = [];
let recordEntryNew:Entry[] = [];
let recordIndex = 0;
export const recordIndexReset =()=> recordIndex = 0;
export const recordEntrySwap =()=>
{
    recordEntry = recordEntryNew;
    recordEntryNew = [] as Entry[];
};
const proxySignal =(arg)=>
{
    const lookupOld = recordEntry[recordIndex];
    if(lookupOld && lookupOld[1] === arg)
    {
        recordEntryNew[recordIndex] = lookupOld;
        recordIndex++;
        return lookupOld[0];
    }
    else
    {
        const sig = SignalsParts.signal(arg);
        recordEntryNew[recordIndex] = [sig, arg];
        recordEntry[recordIndex] = [sig, arg];
        recordIndex++;
        return sig;
    }
};


export * from "signals-original";
export { proxySignal as signal };
// ? export {ProxyCreate as createElement, ProxyState as useState, ProxyReducer as useReducer };
// ? export default {...ReactParts, createElement:ProxyCreate, useState:ProxyState, useReducer:ProxyReducer};