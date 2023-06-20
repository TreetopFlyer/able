import React from "react";
import * as TW from   "https://esm.sh/@twind/core@1.0.1";
import TWPreTail from "https://esm.sh/@twind/preset-tailwind@1.0.1";
import TWPreAuto from "https://esm.sh/@twind/preset-autoprefix@1.0.1";
import react from "./react.tsx";

const Configure =
{
  theme: {},
  presets:[TWPreTail(), TWPreAuto()]
} as TW.TwindUserConfig;

export const Shadow =(inElement:HTMLElement, inConfig?:TW.TwindUserConfig)=>
{
      /*
    const merge = inConfig ? {...Configure, ...inConfig} : Configure;

    const ShadowDOM = inElement.attachShadow({ mode: "open" });
    const ShadowDiv = document.createElement("div");
    const ShadowCSS = document.createElement("style");

    ShadowDOM.append(ShadowCSS);
    ShadowDOM.append(ShadowDiv);
    TW.observe(TW.twind(merge, TW.cssom(ShadowCSS)), ShadowDiv);
    return ShadowDiv;
    */

    return inElement;

    
};
export const Render =async(inElement:HTMLElement, inApp:()=>React.JSX.Element)=>
{
  const wrapped = React.createElement(()=> React.createElement(inApp, null), null);

  if(React.render)
  {
    React.render(wrapped, inElement);
    return ()=>React.unmountComponentAtNode(inElement);
  }
  else
  {
    const reactDom = await import(`https://esm.sh/react-dom@${React.version}/client`);
    const root = reactDom.createRoot(inElement);
    root.render(wrapped);
    return root.unmount;        
  }
};

export default async(inSelector:string, inModulePath:string, inMemberApp="default", inMemberCSS="CSS"):Promise<()=>void|false>=>
{
  const members = await import(inModulePath);
  const element = document.querySelector(inSelector);
  return element ? await Render(Shadow(element as HTMLElement, members.CSS), members.default) : false;
};