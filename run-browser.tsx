import React from "react";
import * as TW from   "@twind/core";
import TWPreTail from "https://esm.sh/v126/@twind/preset-tailwind@1.1.3/es2022/preset-tailwind.mjs";
import TWPreAuto from "https://esm.sh/v126/@twind/preset-autoprefix@1.0.7/es2022/preset-autoprefix.mjs";

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

export default async(inSelector:string, inModulePath:string, inMemberApp="default", inMemberCSS="CSS", inShadow=false):Promise<(()=>void)|false>=>
{
  if(!inModulePath)
  {
    return false;
  }

  let dom = document.querySelector(inSelector);
  if(!dom)
  {
    console.log(`element "${inSelector}" not found.`);
    return false;
  }

  const module = await import(inModulePath);

  if(inShadow)
  {
    dom = Shadow(dom as HTMLElement, module[inMemberCSS]);
  }
  else
  {
    TW.install(Configure);
  }

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
