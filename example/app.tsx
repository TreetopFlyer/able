import { VNode } from "https://esm.sh/v118/preact@10.15.1/src/index.js";
import React from "react";

const CTXString = React.createContext("lol");

type StateBinding<T> = [get:T, set:React.StateUpdater<T>];
const CTXState = React.createContext(null) as React.Context<StateBinding<number>|null>;
const Outer =(props:{children:VNode})=>
{
    const binding = React.useState(11);
    return <CTXState.Provider value={binding}>
        {props.children}
    </CTXState.Provider>
};
const Inner =()=>
{
    const [stateGet, stateSet] = React.useContext(CTXState) || ["default", ()=>{}];
    return <button onClick={e=>stateSet((old)=>old+1)}>count: {stateGet} :)</button>
};


export default ()=>
{
    return <CTXString.Provider value="intradestink">
        <div>
            <h1>Title!</h1>
            <h2>subtitle</h2>
        </div>
        <Outer>
            <Inner/>
        </Outer>
        <Outer>
            <Inner/>
        </Outer>
    </CTXString.Provider>
}