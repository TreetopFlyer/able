import { walk, type WalkOptions, ensureFile } from "https://deno.land/std@0.204.0/fs/mod.ts";

import ts, { isAssertEntry } from "npm:typescript";
const tsopts:ts.CompilerOptions = { declaration: true, emitDeclarationOnly: true };
const tshost = ts.createCompilerHost(tsopts);
const tstypes =(fileName: string):string=> {
    let output = "";
    tshost.writeFile = (fileName: string, contents: string) => output = contents;
    ts.createProgram([fileName], tsopts, tshost).emit();
    return output;
}
const tstypes_all =(fileNames: string[]):string[]=> {
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
const extensions = ["tsx", "ts", "jsx", "js"];
try
{
    await Deno.remove(".bake", { recursive: true });
    console.log("rebuilding baked files");
}
catch(e)
{
    console.log("fresh bake");
}
for await(const file of walk(dir, {includeDirs:false}))
{    
    const pathClean = file.path.replaceAll("\\", "/");
    const pathRel = pathClean.substring(dir.length);

    if(!pathRel.startsWith(".") && !pathRel.includes("/."))
    {  
        const extension = file.name.substring(file.name.lastIndexOf(".")+1);
        const pathBake = `.bake${pathRel}`;
        if(extensions.includes(extension))
        {
            const pathDTS = pathBake.substring(0, pathBake.lastIndexOf("."))+".d.ts";

            console.log("processing", pathRel);
    
            const text = await Deno.readTextFile(pathClean);
            const {code} = await SWCW.transform(text, { ...options, filename:file.name});        

            // check for types export directive
            let tripleSlash = "";
            const read = await Deno.open(file.path);
            const buffer = new Uint8Array(256); // Set the buffer size to the maximum line length
            try {
                const bytesRead = await read.read(buffer);
                if(bytesRead)
                {
                    if(new TextDecoder().decode(buffer.subarray(0, bytesRead)).indexOf("@able-types") != -1)
                    {
                        tripleSlash =`/// <reference types=".${pathDTS.substring(pathDTS.lastIndexOf("/"))}" />\n`;
                    }
                }
            } finally {
                read.close();
            }
        
            await ensureFile(pathBake);
            await Deno.writeTextFile(pathBake, tripleSlash+code);

            if(tripleSlash)
            {
                console.log("making types")
                await ensureFile(pathDTS);
                await Deno.writeTextFile(pathDTS, tstypes("."+pathRel));   
            }
         
        }
        else
        {
            await Deno.copyFile("."+pathRel, pathBake);
        }
    }
}

