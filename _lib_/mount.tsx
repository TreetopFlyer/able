import React from "react";
import * as TW from   "https://esm.sh/@twind/core@1.0.1";
import TWPreTail from "https://esm.sh/@twind/preset-tailwind@1.0.1";
import TWPreAuto from "https://esm.sh/@twind/preset-autoprefix@1.0.1";

const Configure =
{
  theme: {},
  presets: [TWPreTail(), TWPreAuto()],
  hash: false
} as TW.TwindUserConfig;

export const Shadow =(inElement:HTMLElement, inConfig?:TW.TwindUserConfig)=>
{
    const merge = inConfig ? {...Configure, ...inConfig} : Configure;

    const ShadowDOM = inElement.attachShadow({ mode: "open" });
    const ShadowDiv = document.createElement("div");
    const ShadowCSS = document.createElement("style");

    ShadowDOM.append(ShadowCSS);
    ShadowDOM.append(ShadowDiv);
    TW.observe(TW.twind(merge, TW.cssom(ShadowCSS)), ShadowDiv);
    return ShadowDiv;
};

export default async(inSelector:string, inModulePath:string, inMemberApp="default", inMemberCSS="CSS"):Promise<(()=>void)|false>=>
{
  let dom = document.querySelector(inSelector);
  if(!dom)
  {
    console.log(`element "${inSelector}" not found.`);
    return false;
  }

  const module = await import(inModulePath);
  dom = Shadow(dom as HTMLElement, module[inMemberCSS])

  const app = React.createElement(()=> React.createElement(module[inMemberApp], null), null);
  if(React.render)
  {
    React.render(app, dom);
    return ()=>dom && React.unmountComponentAtNode(dom);
  }
  else
  {
    const reactDom = await import(`https://esm.sh/react-dom@${React.version}/client`);
    const root = reactDom.createRoot(dom);
    root.render(app);
    return root.unmount;        
  }

};