import React from "react";

type StateArgs = {done?:boolean, open?:boolean};
type StateObj = {done:boolean, open:boolean};
type StateBinding = [state:StateObj, update:(args:StateArgs)=>void];

const CTX = React.createContext([{done:true, open:false}, (args)=>{}] as StateBinding);

export const Group =(props:{children:React.JSX.Element|React.JSX.Element[]})=>
{
    const [stateGet, stateSet] = React.useState({done:true, open:false} as StateObj);
    return <CTX.Provider value={[stateGet, (args:StateArgs)=> stateSet({...stateGet, ...args})]}>{props.children}</CTX.Provider>;
};

export const Menu =(props:{children:React.JSX.Element|React.JSX.Element[]})=>
{
    const [stateGet, stateSet] = React.useContext(CTX);
    const refElement:React.MutableRefObject<HTMLElement|null> = React.useRef( null );
    const refControl:React.MutableRefObject<CollapseControls|null> = React.useRef( null );
    const refInitial:React.MutableRefObject<boolean> = React.useRef(true);

    type MenuClassStates = {Keep:string, Open:string, Shut:string, Move:string, Exit:string};
    const base = `relative transition-all border(8 black) overflow-hidden`;
    const Classes:MenuClassStates =
    {
      Shut: `${base} h-0    top-0  w-1/2   duration-300`,
      Open: `${base} h-auto top-8  w-full  duration-700`,
      lol: `${base} h-auto top-36 bg-yellow-500  w-2/3  duration-700`,
    };
    const Window = window as {TwindInst?:(c:string)=>string};
    if(Window.TwindInst)
    {
      for(let stateName in Classes)
      {
        Classes[stateName as keyof MenuClassStates] = Window.TwindInst(Classes[stateName as keyof MenuClassStates]);
      }
    }

    React.useEffect(()=>
    {
      refControl.current = refElement.current && Collapser(refElement.current, stateGet.open ? "Open" : "Shut", Classes);
    }
    , []);
    React.useEffect(()=>
    {
      (!refInitial.current && refControl.current) && refControl.current(stateGet.open ? "Open" : "Shut", ()=>stateSet({done:true}));
      refInitial.current = false;
    }
    , [stateGet.open]);

    useAway(refElement, (e)=>stateSet({open:false, done:false}) );

    return <div ref={refElement as React.Ref<HTMLDivElement>} class={Classes.Shut}>
      { (!stateGet.open && stateGet.done) ? null : props.children}
    </div>;
};

export const Button =()=>
{
    const [stateGet, stateSet] = React.useContext(CTX);
    return <>
        <p>{JSON.stringify(stateGet)}</p>
        <button class="px-10 py-2 bg-red-500 text-white" onClick={e=>stateSet({open:true,  done:false})}>Open</button>
        <button class="px-10 py-2 bg-red-500 text-white" onClick={e=>stateSet({open:false, done:false})}>Close</button>
    </>;
};

type Handler = (e:MouseEvent)=>void
const Refs:Map<HTMLElement, React.Ref<Handler>> = new Map();
function isHighest(inElement:HTMLElement, inSelection:HTMLElement[])
{
  let currentNode = inElement;
  while (currentNode != document.body)
  {
    currentNode = currentNode.parentNode as HTMLElement;
    if(currentNode.hasAttribute("data-use-away") && inSelection.includes(currentNode))
    {
      return false;
    }    
  }
  return true;
}
window.innerWidth && document.addEventListener("click", e=>
{
  const path = e.composedPath();
  const away:HTMLElement[] = [];

  Refs.forEach( (handlerRef, element)=>
  {
    if(!path.includes(element) && handlerRef.current)
    {
      away.push(element);
    }
  });

  away.forEach((element)=>
  {
    if(isHighest(element, away))
    {
      const handler = Refs.get(element);
      handler?.current && handler.current(e);
    }
  });

}
, true);
const useAway =(inRef:React.Ref<HTMLElement>, handleAway:Handler)=>
{
  const refHandler:React.MutableRefObject<Handler> = React.useRef(handleAway);
  refHandler.current = handleAway;

  React.useEffect(()=>
  {
    if(inRef.current)
    {
      inRef.current.setAttribute("data-use-away", "0");
      Refs.set(inRef.current, refHandler);      
    }
    return ()=> inRef.current && Refs.delete(inRef.current);
  }
  , []);
};

type StyleSize = [classes:string, width:number, height:number];
type StylePack = Record<string, string>;
type StyleCalc = Record<string, StyleSize>;
const StyleCalc =(inElement:HTMLElement, inClasses:StylePack)=>
{
  const initialStyle = inElement.getAttribute("style")||"";
  const initialClass = inElement.getAttribute("class")||"";
  const output = {} as StyleCalc;

  inElement.setAttribute("style", `transition: none;`);
  Object.entries(inClasses).forEach(([key, value])=>
  {
    inElement.setAttribute("class", value);
    output[key] =  [value, inElement.offsetWidth, inElement.offsetHeight];
  });
  inElement.setAttribute("class", initialClass);
  inElement.offsetHeight; // this has be be exactly here
  inElement.setAttribute("style", initialStyle);

  return output;
};

type DoneCallback =(inState:string)=>void;
export type CollapseControls =(inOpen?:string, inDone?:DoneCallback)=>void;
export function Collapser(inElement:HTMLElement, initialState:string, library:Record<string, string>)
{
    let userDone:DoneCallback = (openState) => {};
    let userMode = initialState;
    let frameRequest = 0;
    let inTransition = false;
    let measurements:StyleCalc;
    const transitions:Set<string> = new Set();

    const run = (inEvent:TransitionEvent)=> (inEvent.target == inElement) && transitions.add(inEvent.propertyName);
    const end = (inEvent:TransitionEvent)=>
    {
      if (inEvent.target == inElement)
      {
        transitions.delete(inEvent.propertyName);
        if(transitions.size === 0)
        {
          measurements = StyleCalc(inElement, library);
          const [, w, h] = measurements[userMode];
          if(inElement.offsetHeight != h || inElement.offsetWidth != w)
          {
            anim(userMode, userDone);
          }
          else
          {
            inElement.setAttribute("style", "");
            inTransition = false;
            userDone(userMode);   
          }
        }
      }
    };
    const anim = function(inState:string, inDone)
    {
      cancelAnimationFrame(frameRequest);

      if(arguments.length)
      {
        if(!library[inState]){ return; }

        userDone = inDone|| ((m)=>{}) as DoneCallback;
        userMode = inState;

        if(!inTransition)
        {
          measurements = StyleCalc(inElement, library);
        }

        if(measurements)
        {
          const [classes, width, height] = measurements[inState] as StyleSize;
          const oldWidth = inElement.offsetWidth;
          const oldHeight = inElement.offsetHeight;
          inElement.style.width  = oldWidth  + "px";
          inElement.style.height = oldHeight + "px";
          inTransition = true;

          frameRequest = requestAnimationFrame(()=>
          {
            inElement.style.height = height + "px";
            inElement.style.width = width + "px";
            inElement.className = classes;
          });
        }
      }
      else
      {
        inElement.removeEventListener("transitionrun", run);
        inElement.removeEventListener("transitionend", end);
      }
    } as CollapseControls;

    inElement.addEventListener("transitionend", end);
    inElement.addEventListener("transitionrun", run);

    return anim;
} 
