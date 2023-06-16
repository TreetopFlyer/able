import { VNode } from "https://esm.sh/v118/preact@10.15.1/src/index.js";
import React from "react";

const CTXString = React.createContext("lol");

const Butt =(props:{label:string})=>
{
    const [countGet, countSet] = React.useState(3);
    return <button onClick={e=>countSet(countGet+1)}>{props.label+" -- "+countGet}</button>;
};

type StateBinding<T> = [get:T, set:React.StateUpdater<T>];
const CTXState = React.createContext(null) as React.Context<StateBinding<string>|null>;
const Outer =(props:{children:VNode})=>
{
    const binding = React.useState("lol?");
    return <CTXState.Provider value={binding}>
        {props.children}
    </CTXState.Provider>
};
const Inner =()=>
{
    const binding = React.useContext(CTXState);
    return <button onClick={e=>binding && binding[1](Math.random().toString())}>{binding?.[0]??"(its null)"}!</button>
};


export default ()=>
{
    return <CTXString.Provider value="intradestink">
        <div><h1>hey???</h1></div>
        <Outer>
            <Inner/>
        </Outer>
        <Outer>
            <Inner/>
        </Outer>
    </CTXString.Provider>
}