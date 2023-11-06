import { walk, type WalkOptions, ensureFile } from "https://deno.land/std@0.204.0/fs/mod.ts";

import ts from "npm:typescript";
const tsopts:ts.CompilerOptions = { declaration: true, emitDeclarationOnly: true };
const tshost = ts.createCompilerHost(tsopts);
const tstypes =(fileNames: string[]):string[]=> {
    const output:string[] = [];
    tshost.writeFile = (fileName: string, contents: string) => output[fileName.indexOf(fileName)] = contents;
    ts.createProgram(fileNames, tsopts, tshost).emit();
    return output;
}

import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";

await SWCW.default();
const options:SWCW.Options = {
    sourceMaps: false,
    minify: true,
    jsc:
    {
        target:"es2022",
        minify:
        {
            compress: { unused: true },
            mangle: false
        },
        parser:
        {
            syntax: "typescript",
            tsx: true,
        },
        transform:
        {
            react: { runtime: "automatic" }
        }
    }
}


const dir = Deno.cwd();
const folder = dir.substring(dir.lastIndexOf("\\")+1);
console.log("searching", dir);

for await(const file of walk(dir, {exts:["tsx", "ts", "jsx", "js"], includeDirs:false}))
{
    const pathClean = file.path.replaceAll("\\", "/");
    const text = await Deno.readTextFile(pathClean);

    const {code} = await SWCW.transform(text, { ...options, filename:file.name});
    const pathRel = pathClean.substring(dir.length);
    const pathJS = `baked${pathRel}`;
    const pathDTS = pathJS.substring(0, pathJS.lastIndexOf("."))+".d.ts";
    
    await ensureFile(pathDTS);
    await ensureFile(pathJS);

    await Deno.writeTextFile(pathJS, `/// <reference types=".${pathDTS.substring(pathDTS.lastIndexOf("/"))}" />\n${code}`, {create:true});
}



const output = tstypes(['hmr-listen.tsx']);
console.log(output);