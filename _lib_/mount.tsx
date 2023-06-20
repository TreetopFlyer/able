import * as TW from   "https://esm.sh/@twind/core@1.0.1";
import TWPreTail from "https://esm.sh/@twind/preset-tailwind@1.0.1";
import TWPreAuto from "https://esm.sh/@twind/preset-autoprefix@1.0.1";

const Configure = {
  theme: {},
  presets:[TWPreTail(), TWPreAuto()]
} as TW.TwindUserConfig;

export default (inElement:HTMLElement, inConfig?:TW.TwindUserConfig)=>
{
    const ShadowDOM = inElement.attachShadow({ mode: "open" });
    const ShadowDiv = document.createElement("div");
    const ShadowCSS = document.createElement("style");
    ShadowDOM.append(ShadowCSS);
    ShadowDOM.append(ShadowDiv);

    const merge = inConfig ? {...Configure, ...inConfig} : Configure;
    TW.observe(TW.twind(merge, TW.cssom(ShadowCSS)), ShadowDiv);
    return ShadowDiv;
}


import * as App from "app";
import React from "react";
const Wrapper =()=> React.createElement(App.default, null, null);
React.render(React.createElement(Wrapper, null, null), document.querySelector("#app"));
