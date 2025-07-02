import { JSDOM } from 'jsdom';

export async function BuildPage(template, script, url) {

    const host = 'nijor://building-pages';
    const eventName = 'app-loaded';
    const timeout = 5000;

    return new Promise(async (resolve, reject) => {
        try {
            const dom = new JSDOM(template, { runScripts: "outside-only", url: host + url });
            shimDom(dom);

            if (eventName) {
                const eventTimeout = setTimeout(() => {
                    if (dom.window._document) {
                        resolveHtml(dom,resolve);
                    }
                }, timeout);
                dom.window.addEventListener(eventName, ()=> resolveHtml(dom,resolve));
                dom.window.addEventListener(eventName, ()=> clearTimeout(eventTimeout));
            }

            dom.window.eval(script);

            if (!eventName) resolveHtml(dom,resolve);

        } catch (err) { 
            // console.log(err);
        };
    })
}

function shimDom(dom) {
    dom.window.rendering = true;
    dom.window.alert = (_msg) => { };
    dom.window.scrollTo = () => { };
    dom.window.requestAnimationFrame = () => { };
    dom.window.cancelAnimationFrame = () => { };
    dom.window.TextEncoder = TextEncoder;
    dom.window.TextDecoder = TextDecoder;
    dom.window.fetch = fetch;
    dom.window.matchMedia = ()=> {
        return {
            matches: false,
            addEventListener : ()=>{}
        }
    }
}

function resolveHtml(dom,resolve) {

    for (const { type , data } of process.staticTemplate){
        if(type==='csr') handleCSR(dom.window.document, data);
        if(type==='ssr') handleSSR(dom.window.document, data, dom.window.location.pathname);
    }

    dom.window.document.body.removeAttribute('theme');
    let html = dom.serialize();
    resolve(html);
    dom.window.close();
}

function handleCSR(document, { id, content, script }){
    const element = document.getElementById(id);
    if(element) {
        if(content!=null) element.innerHTML = content;
        let hydartionScript = document.head.querySelector("script[type='hydration']");

        if(script!=null){
            if(!hydartionScript){
                hydartionScript = document.createElement('script');
                hydartionScript.setAttribute('type','hydration');
                document.head.appendChild(hydartionScript);
            }
            hydartionScript.innerHTML+= script;
        }

    }
}

function handleSSR(document, data, route){
    const element = document.getElementById(data.id);
    if(element) {
        element.innerHTML = data.content;
        let hydartionScript = document.head.querySelector("script[type='hydration']");

        if(data.script!=null){
            if(!hydartionScript){
                hydartionScript = document.createElement('script');
                hydartionScript.setAttribute('type','hydration');
                document.head.appendChild(hydartionScript);
            }
            hydartionScript.innerHTML+= data.script;
        }
        
        if(!process.serverCodeMap.has(route)) process.serverCodeMap.set(route,new Set());
        process.serverCodeMap.get(route).add(data.server);

        if(!process.serverParamsMap.has(route)) process.serverParamsMap.set(route,data.params);
    }
}