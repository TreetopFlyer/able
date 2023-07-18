
type GlyphCheck = (inGlyph:string)=>boolean
const isAlphaLike:GlyphCheck =(inGlyph:string)=>
{
    const inCode = inGlyph.charCodeAt(0);

    if(inCode >= 97 && inCode <= 122)
    {
        return true;
    }

    if(inCode >= 65 && inCode <= 90)
    {
        return true;
    }

    return `$_.`.includes(inGlyph);
}
const isWhiteSpace:GlyphCheck =(inGlyph:string)=> `\n\r\t `.includes(inGlyph);
const isQuote:GlyphCheck =(inGlyph:string)=>`"'\``.includes(inGlyph)
const isNot =(inCheck:GlyphCheck)=> (inGlyph:string)=>!inCheck(inGlyph);
const contiguous =(inText:string, inStart:number, inTest:GlyphCheck):number=>
{
    let ok = true;
    let index = inStart;
    let count = 0;
    while(ok && count < inText.length)
    {
        count++;
        ok = inTest(inText.charAt(index++));
    }
    return index-1;
}

const findNextExport =(inFile:string, inIndex=0, inLocal:Array<string>, inForeign:Array<string>)=>
{
    const pos = inFile.indexOf("export", inIndex);
    if(pos !== -1)
    {
        if(!isAlphaLike(inFile.charAt(pos-1)) || !isAlphaLike(inFile.charAt(pos+6)))
        {
            
            const nextCharInd = contiguous(inFile, pos+6, isWhiteSpace);
            const nextChar = inFile[nextCharInd];

            //console.log(inFile.substring(pos, nextCharInd+1), `>>${nextChar}<<`)

            if(nextChar === "*")
            {
                const  firstQuoteInd = contiguous(inFile,   nextCharInd+1, isNot(isQuote) );
                const secondQuoteInd = contiguous(inFile, firstQuoteInd+1, isNot(isQuote) );
                //console.log("ASTERISK:", inFile.substring(pos, secondQuoteInd+1));
                inForeign.push(inFile.substring(nextCharInd, secondQuoteInd+1));
            }
            else if(nextChar == "{")
            {
                const endBracketInd = contiguous(inFile, nextCharInd, (inGlyph:string)=>inGlyph!=="}");
                const nextLetterInd = contiguous(inFile, endBracketInd+1, isWhiteSpace);
                if(inFile.substring(nextLetterInd, nextLetterInd+4) == "from")
                {
                    const  firstQuoteInd = contiguous(inFile, nextLetterInd+4, isNot(isQuote) );
                    const secondQuoteInd = contiguous(inFile, firstQuoteInd+1, isNot(isQuote) );
                    //console.log(`BRACKET foreign: >>${inFile.substring(nextCharInd, secondQuoteInd+1)}<<`);
                    inForeign.push(inFile.substring(nextCharInd, secondQuoteInd+1));
                }
                else
                {
                    const members = inFile.substring(nextCharInd+1, endBracketInd);
                    members.split(",").forEach(part=>
                    {
                        const renamed = part.split(" as ");
                        inLocal.push(renamed[1] || renamed[0]);
                    });
                }
                
            }
            else if(isAlphaLike(nextChar))
            {
                const keywordEndInd = contiguous(inFile, nextCharInd, isAlphaLike);
                const keyword = inFile.substring(nextCharInd, keywordEndInd);
                if(keyword === "default")
                {
                    inLocal.push(keyword);
                    //console.log(`MEMBER: >>${keyword})}<<`);
                }
                else if(["const", "let", "var", "function", "class"].includes(keyword))
                {
                    const varStartInd = contiguous(inFile, keywordEndInd+1, isWhiteSpace);
                    const varEndInd = contiguous(inFile, varStartInd+1, isAlphaLike);
                    //console.log(`MEMBER: >>${inFile.substring(varStartInd, varEndInd)}<<`);
                    inLocal.push(inFile.substring(varStartInd, varEndInd))
                }
            }
        }

        return pos + 7;
    }
    else
    {
        return false;
    }
};

export const Exports =(inFile:string)=>
{
    let match = 0 as number|false;
    let count = 0;
    const local = [] as string[];
    const foreign = [] as string[];
    while(match !== false && count <200)
    {
        count++;
        match = findNextExport(inFile, match, local, foreign);
    }
    return[local, foreign] as [local:string[], foreign:string[]];
};

export const FileExports =async(inURL:string|URL)=>
{
    const resp = await fetch(inURL);
    const text = await resp.text();
    return Exports(text);
}

//console.log(await FileExports(import.meta.resolve("./hmr-listen.tsx")));

/*
const [local, global] = Exports(`
// export in comment
export * from "react";
const fakeexport =()=>{};
export{ thing1 as remapped, thing2}
export{ thing1 as remapped, thing2} from 'React';
export 
export const func=()=>{};
`);

console.log(local, global);
*/