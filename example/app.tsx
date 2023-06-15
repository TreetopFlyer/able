import React from "react";

const CTX = React.createContext("lol");

export default ()=>
{
    return <CTX.Provider value="intradestink">
        <div><h1>hey!</h1></div>
        <CTX.Consumer>
            {(value)=><button>{value}</button>}
        </CTX.Consumer>
    </CTX.Provider>
}