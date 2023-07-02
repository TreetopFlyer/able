
import * as Util from "@able/";
import * as React from "react";
import {createElement} from "react/client";

import('react').then((module) => {
  console.log(module);
});


function unimport(n:number)
{
  return n;
}
unimport(123)