import * as SignalsParts from "signals-original";
import { Process } from "./hmr-listen.tsx";


const s1 = SignalsParts.signal(true);

const proxySignal =(arg)=>
{
    console.log("---hmr---", arg);
    return SignalsParts.signal(arg);
}

export * from "signals-original";
export { proxySignal as signal };
// ? export {ProxyCreate as createElement, ProxyState as useState, ProxyReducer as useReducer };
// ? export default {...ReactParts, createElement:ProxyCreate, useState:ProxyState, useReducer:ProxyReducer};