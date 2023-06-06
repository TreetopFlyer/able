import * as SWCW from "https://esm.sh/@swc/wasm-web@1.3.62";

await SWCW.default();

export const Config:SWCW.Options =
{
    sourceMaps: false,
    minify: true,
    jsc:
    {
      minify:
      {
          compress: { unused: true },
          mangle: true
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
    },
}
export const Cache:Map<string, string> = new Map();
export const Clear =()=>
{
    const size = Cache.size;
    Cache.clear();
    return size;
};
export const Fetch =async(inPath:string, inKey:string, inCheckCache=true)=>
{
    if(inPath.endsWith(".tsx") || inPath.endsWith(".jsx") || inPath.endsWith(".js") || inPath.endsWith(".mjs"))
    {
        const check = Cache.get(inPath);
        if(check && inCheckCache)
        {
            return check;
        }
        else
        {
            
            try
            {
                const resp = await fetch(inPath);
                const text = await resp.text();
                const {code} = await SWCW.transform(text, Config);
                Cache.set(inKey, code);
                return code;
            }
            catch(e)
            {
                console.log(`xpile.tsx error. Key:${inKey} Path:${inPath} Error:"${e}"`);
                return null;
            }
        }
    }
    else
    {
        return false;
    }
};