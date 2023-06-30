import "@able/boot-server.tsx";
import React from "react";

const CTXString = React.createContext("lol");

type StateBinding<T> = [get:T, set:React.StateUpdater<T>];
const CTXState = React.createContext(null) as React.Context<StateBinding<number>|null>;
const Outer =(props:{children:React.JSX.Element})=>
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


type Store = {name:string, age:number}
const reducer =(inState:Store, inAction:number)=>
{
    return {...inState, age:inState.age+inAction};
}

const builder =(inState:Store):Store=>
{
    inState.age = 100;
    return inState;
}


export default ()=>
{
    const [Store, Dispatch] = React.useReducer(reducer, {name:"seth", age:24} as Store, builder)
    return <CTXString.Provider value="intradestink">
        <div class="my-4 font-sans">
            <h1 class="font-black text-xl text-red-500">Title????</h1>
            <h2>subtitle!</h2>
            <p>
                <button onClick={e=>Dispatch(1)}>{Store.name}|{Store.age}?</button>
            </p>
        </div>
        <Outer>
            <Inner/>
        </Outer>
        <Outer>
            <Inner/>
        </Outer>
    </CTXString.Provider>;         
}
