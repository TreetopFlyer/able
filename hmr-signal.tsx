import * as SignalsParts from "signals-original";
import DeepEqual from "https://esm.sh/deep-eql@4.1.3";

type Entry<T> = [signal:SignalsParts.Signal<T>, initArg:T];

function ProxyGroup<T>(inFunc:(initArg:T)=>SignalsParts.Signal<T>)
{
    let recordEntry:Entry<T>[] = [];
    let recordEntryNew:Entry<T>[] = [];
    let recordIndex = 0;
    const reset =()=> recordIndex = 0;
    const swap =()=>
    {
        recordEntry = recordEntryNew;
        recordEntryNew = [] as Entry<T>[];
    };
    const proxy =(arg:T)=>
    {
        const lookupOld = recordEntry[recordIndex];
        if(lookupOld && DeepEqual(lookupOld[1], arg))
        {
            recordEntryNew[recordIndex] = lookupOld;
            recordIndex++;
            return lookupOld[0];
        }
        else
        {
            const sig = inFunc(arg);
            recordEntryNew[recordIndex] = [sig, arg];
            recordEntry[recordIndex] = [sig, arg];
            recordIndex++;
            return sig;
        }
    };
    return {reset, swap, proxy};
}

export const GroupSignal = ProxyGroup(SignalsParts.signal);
export const GroupSignalHook = ProxyGroup(SignalsParts.useSignal);


const proxySignal = GroupSignal.proxy;
const proxySignalHook = GroupSignalHook.proxy;

export * from "signals-original";
export { proxySignal as signal, proxySignalHook as useSignal };
export default {...SignalsParts, signal:proxySignal, useSignal:proxySignalHook};