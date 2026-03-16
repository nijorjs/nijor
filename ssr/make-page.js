import { JSDOM } from 'jsdom';
import path from 'path';

const RootPath = process.cwd();
const modulesPath = path.join(RootPath,'assets/modules');

export async function BuildPage(template, script, url) {

    const host = 'http://nijorjs.github.io';
    const eventName = 'app-loaded';
    const timeout = 300;

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
            console.log(err);
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
    const route = dom.window.location.pathname;
    const { file } = process.sourceMap[route];

    let hydartionScript = dom.window.document.head.querySelector("script[type='hydration']");
    if(!hydartionScript){
        hydartionScript = dom.window.document.createElement('script');
        hydartionScript.setAttribute('type','hydration');
        dom.window.document.head.appendChild(hydartionScript);
    }

    hydartionScript.innerHTML += `await import('/modules/layout/${process.layoutMap.get(route)}.js');`;
    hydartionScript.innerHTML += `await import('/modules/${file}');`;
    
    if(process.metadataMap.has(route)){
        let metadata = process.metadataMap.get(route);
        dom.window.document.head.innerHTML += metadata;
    }

    dom.window.document.body.removeAttribute('theme');
    dom.window.document.body.setAttribute('rendered','');

    let html = dom.serialize();
    resolve(html);
    dom.window.close();
}