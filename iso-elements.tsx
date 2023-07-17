import React from "react";

type MetasInputs = { [Property in MetaKeys]?: string };
type MetasModeArgs = {concatListed?:string; dropUnlisted?:boolean};
type MetasStackItem = MetasModeArgs&MetasInputs&{id:string, depth:number}
type Meta = {title:string, description:string, keywords:string, image:string, canonical:string }
type MetaKeys = keyof Meta;

export const Meta =
{
    Stack:[] as MetasStackItem[],
    Meta: {
        title:"",
        description:"",
        keywords:"",
        image:"",
        canonical:""
    } as Meta,
    ComputeFinal(inStack:MetasStackItem[], inStart=0)
    {
        const seed = {
            title:"",
            description:"",
            keywords:"",
            image:"",
            canonical:""
        };
        if(inStack.length>0)
        {
            let final = {...seed, ...inStack[0]};
            for(let i=inStart+1; i<inStack.length; i++)
            {
                const curr = inStack[i];
                Object.keys(seed).forEach(key=>
                {
                    const lookup = key as MetaKeys
                    const valPrev = final[lookup];
                    const valCurr = curr[lookup];

                    if(valPrev && !valCurr)
                    {
                        final[lookup] = curr.dropUnlisted ? "" : valPrev;
                    }
                    else if(valPrev && valCurr)
                    {
                        final[lookup] = curr.concatListed ? valPrev + curr.concatListed + valCurr : valCurr
                    }
                    else
                    {
                        final[lookup] = valCurr||"";
                    }
                });
            }
            return final;
        }
        else
        {
            return seed;
        }
    },
    Context: React.createContext([[], ()=>{}] as [Get:MetasStackItem[], Set:React.StateUpdater<MetasStackItem[]>]),
    Provider({children}:{children:Children})
    {
        const binding = React.useState([] as MetasStackItem[]);

        type MetaDOM = {description:NodeListOf<Element>, title:NodeListOf<Element>, image:NodeListOf<Element>, url:NodeListOf<Element>};

        const refElements = React.useRef(null as null | MetaDOM);

        React.useEffect(()=>
        {
            refElements.current = {
                description:document.querySelectorAll(`head > meta[name$='description']`),
                title:document.querySelectorAll(`head > meta[name$='title']`),
                image:document.querySelectorAll(`head > meta[name$='image']`),
                url:document.querySelectorAll(`head > link[rel='canonical']`)
            };
        }, []);

        React.useEffect(()=>
        {
            if(refElements.current)
            {
                const final = Meta.ComputeFinal(binding[0]);

                refElements.current.url.forEach(e=>e.setAttribute("content", final.canonical||""));
                document.title = final.title;
                refElements.current.title.forEach(e=>e.setAttribute("content", final.title||""));
                refElements.current.image.forEach(e=>e.setAttribute("content", final.image||""));
                refElements.current.description.forEach(e=>e.setAttribute("content", final.description||""));
            }
        });
        return <Meta.Context.Provider value={binding}>{children}</Meta.Context.Provider>;
    },
    Metas({concatListed=undefined, dropUnlisted=false, ...props}:MetasModeArgs&MetasInputs):null
    {
        const id = React.useId();
        const [, metasSet] = React.useContext(Meta.Context);
        const {depth} = React.useContext(SwitchContext);

        React.useEffect(()=>{
            metasSet((m)=>{
                console.log(`adding meta`, props, depth);
                const clone = [...m];
                let i;
                for(i=clone.length-1; i>-1; i--)
                {
                    if(clone[i].depth <= depth)
                    {
                        break;
                    }
                }
                clone.splice(i+1, 0, {id, depth, concatListed, dropUnlisted, ...props});
                return clone;
            });
            return ()=>
            {
                metasSet((m)=>{
                    const clone = [...m];
                    const ind = clone.findIndex(i=>i.id === id);      
                    if(ind > -1)
                    {
                        console.log(`removing meta`, props, depth);
                        clone.splice(ind, 1);
                    } 
                    return clone;
                });

            };
        }, []);

        React.useEffect(()=>{
            metasSet((m)=>{
                const clone = [...m];
                const ind = clone.findIndex(i=>i.id === id);      
                if(ind > -1)
                {
                    console.log(`updating meta`, props, depth);
                    clone[ind] = {...clone[ind], ...props};
                } 
                return clone;
            });
        }, Object.keys(props).map( (key) => props[key as MetaKeys] ));

        if(!window.innerWidth && props.title)
        {
            Meta.Stack.push({id, depth, concatListed, dropUnlisted, ...props});
        }

        return null;
    }
};


export type Children = string | number | React.JSX.Element | React.JSX.Element[];

type RoutePath = Array<string>;
type RouteParams = Record<string, string|number|boolean>;
type RouteState = {URL:URL, Path:RoutePath, Params:RouteParams, Anchor:string};
type RouteContext = [Route:RouteState, Update:(inPath?:RoutePath, inParams?:RouteParams, inAnchor?:string)=>void];
type RouteProps = {children:Children, url?:URL };
export const Router = {
    Parse(url:URL):RouteState
    {
        const Path = url.pathname.substring(1, url.pathname.endsWith("/") ? url.pathname.length-1 : url.pathname.length).split("/");
        const Params:RouteParams = {};
        new URLSearchParams(url.search).forEach((k, v)=> Params[k] = v);
        const Anchor = url.hash.substring(1);
        return {URL:url, Path, Params, Anchor} as RouteState;
    },
    Context:React.createContext([{URL:new URL("https://original.route/"), Path:[], Params:{}, Anchor:""}, ()=>{}] as RouteContext),
    Provider(props:RouteProps)
    {
        const [routeGet, routeSet] = React.useState(Router.Parse(props.url || new URL(document.location.href)));
        const [dirtyGet, dirtySet] = React.useState(true);

        const routeUpdate:RouteContext[1] =(inPath, inParams, inAnchor)=>
        {
            const clone = new URL(routeGet.URL);
            inPath && (clone.pathname = inPath.join("/"));
            inParams && (clone.search = new URLSearchParams(inParams as Record<string, string>).toString());
            routeSet({
                URL:clone,
                Path: inPath || routeGet.Path,
                Params: inParams || routeGet.Params,
                Anchor: inAnchor || routeGet.Anchor
            });
        };

        // when the state changes, update the page url
        React.useEffect(()=> dirtyGet ? dirtySet(false) : history.pushState({...routeGet, URL:undefined}, "", routeGet.URL), [routeGet.URL.href]);

        React.useEffect(()=>{
            history.replaceState({...routeGet, URL:undefined}, "", routeGet.URL);
            window.addEventListener("popstate", ({state})=>
            {
                dirtySet(true);
                routeUpdate(state.Path, state.Params, state.Anchor);
            });
            document.addEventListener("click", e=>
            {
                const path = e.composedPath() as HTMLAnchorElement[];
                for(let i=0; i<path.length; i++)
                {
                    if(path[i].href)
                    {
                        const u = new URL(path[i].href);
                        if(u.origin == document.location.origin)
                        {
                            e.preventDefault();
                            const parts = Router.Parse(u);
                            routeUpdate(parts.Path, parts.Params, parts.Anchor);
                        }
                        return;
                    }
                }
            })
        }, []);

        return <Router.Context.Provider value={[routeGet, routeUpdate]}>{props.children}</Router.Context.Provider>;
    },
    Consumer()
    {
        return React.useContext(Router.Context);
    }
};

type SwitchContext = {depth:number, keys:Record<string, string>};
export const SwitchContext = React.createContext({depth:0, keys:{}} as SwitchContext);
export const Switch =({children}:{children:Children})=>
{
    let fallback = null;
    if(Array.isArray(children))
    {
        const contextSelection = React.useContext(SwitchContext);
        const [contextRoute] = Router.Consumer();
        const routeSegment = contextRoute.Path.slice(contextSelection.depth);
        const checkChild =(inChild:{props:{value?:string}})=>
        {
            if(inChild?.props?.value)
            {   
                const parts = inChild.props.value.split("/");
                if(parts.length > routeSegment.length)
                {
                    return false;
                }
    
                const output:SwitchContext = {depth:contextSelection.depth+parts.length, keys:{}};
                for(let i=0; i<parts.length; i++)
                {
                    const partRoute = routeSegment[i];
                    const partCase = parts[i];
                    if(partCase[0] == ":")
                    {
                        output.keys[partCase.substring(1)] = partRoute;
                    }
                    else if(partCase != "*" && partCase != partRoute)
                    {
                        return false;
                    }
                }
                return output;
            }
            return false;
        }

        for(let i=0; i<children.length; i++)
        {
            const childCase =  children[i];
            const childCaseChildren = childCase.props?.__args?.slice(2) || childCase.props.children;
            const newContextValue = checkChild(childCase);
            if(newContextValue)
            {
                return <SwitchContext.Provider value={newContextValue}>{childCaseChildren}</SwitchContext.Provider>
            }
            if(childCase?.props?.default && !fallback)
            {
                //console.log(routeSegment);
                fallback = childCaseChildren;
            }
        } 
    }

    return fallback;
};
export const Case =({children, value}:{children:Children, value?:string, default?:true})=>null;
export const useRouteVars =()=> React.useContext(SwitchContext).keys;

export type FetchCachOptions = {CacheFor:number, CacheOnServer:boolean, DelaySSR:boolean, Seed:boolean};
export type FetchRecord = {URL:string, Promise?:Promise<FetchRecord>, CachedAt:number, Error?:string, JSON?:object} & FetchCachOptions;
type FetchGuide = [Record:FetchRecord, Init:boolean, Listen:boolean];
export type FetchHookState = [Data:undefined|object, Updating:boolean];
export const Fetch = {
    Cache:new Map() as Map<string, FetchRecord>,
    ServerBlocking:false as false|Promise<FetchRecord>[],
    ServerTouched:false as false|Set<FetchRecord>,
    ServerRemove:false as false|Set<FetchRecord>,
    Seed(seed:FetchRecord[])
    {
        seed.forEach(r=>{
            //r.Promise = Promise.resolve(r);
            Fetch.Cache.set(r.URL, r)
        });
    },
    DefaultOptions:{CacheFor:60, CacheOnServer:true, DelaySSR:true, Seed:true} as FetchCachOptions,
    Request(URL:string, Init?:RequestInit|null, CacheFor:number = 60, CacheOnServer:boolean = true, DelaySSR:boolean = true, Seed:boolean = true):FetchGuide
    {
        let check = Fetch.Cache.get(URL);
        
        const load =(inCheck:FetchRecord)=>
        {
            Fetch.Cache.set(URL, inCheck);
            inCheck.CachedAt = 0;
            inCheck.Promise = fetch(URL, Init?Init:undefined).then(resp=>resp.json()).then((json)=>{
                inCheck.JSON = json;
                inCheck.CachedAt = new Date().getTime();
                //console.log(`...cached!`);
                return inCheck;
            });
            return inCheck;
        };

        if(!check)
        {
            // not in the cache
            // - listen

            //console.log(`making new cache record...`);
            return [load({URL, CacheFor, CachedAt:0, CacheOnServer, DelaySSR, Seed}), false, true];
        }
        else if(check.CachedAt == 0)
        {
            // loading started but not finished
            // - listen
            // - possibly init if there is something in JSON

            //console.log(`currently being cached...`);
            return [check, check.JSON ? true : false, true];
        }
        else
        {
            //console.log(`found in cache...`);
            let secondsAge = (new Date().getTime() - check.CachedAt)/1000;
            if(secondsAge > check.CacheFor)
            {
                // cached but expired
                // - listen
                // - init
                //console.log(`...outdated...`);
                return [load(check), true, true];
            }
            else
            {
                // cached and ready
                // - init
                //console.log(`...retrieved!`);
                return [check, true, false];
            }

        }
    },

    Use(URL:string, Init?:RequestInit|null, Options?:FetchCachOptions)
    {
        const config = {...Fetch.DefaultOptions, ...Options};
        const [receipt, init, listen] = Fetch.Request(URL, Init, config.CacheFor, config.CacheOnServer, config.DelaySSR, config.Seed);
        const initialState:FetchHookState = init ? [receipt.JSON, listen] : [undefined, true];
        const [cacheGet, cacheSet] = React.useState(initialState);

        if(Fetch.ServerBlocking && Fetch.ServerTouched && config.DelaySSR) // if server-side rendering
        {
            if(listen) // if the request is pending
            {
                receipt.Promise && Fetch.ServerBlocking.push(receipt.Promise); // add promise to blocking list
                return [undefined, listen] as FetchHookState; // no need to return any actual data while waiting server-side
            }
            else // if request is ready
            {
                receipt.Seed && Fetch.ServerTouched.add(receipt); // add record to client seed list (if specified in receipt.seed)
                return [receipt.JSON, false] as FetchHookState;
            }
        }

        React.useEffect(()=>
        {
            if(listen)
            {
                //const receipt = Fetch.Request(URL, Init, CacheFor, CacheOnServer, DelaySSR);
                receipt.Promise?.then(()=>cacheSet([receipt.JSON, receipt.CachedAt === 0]));
            }
        }
        , []);

        return cacheGet;
    }
};