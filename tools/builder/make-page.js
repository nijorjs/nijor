import {JSDOM} from 'jsdom';

export async function BuildPage(template, script, url) {

    const host = 'http://nijorjs.github.io';
    const eventName = 'app-loaded';
    const timeout = 5000;

    return new Promise(async (resolve, reject) => {
        try {
            const dom = new JSDOM(template, { runScripts: "outside-only", url: host + url });
            
            shimDom(dom);

            if (eventName) {
                const eventTimeout = setTimeout(() => {
                    if (dom.window._document) {
                        resolveHtml();
                    }
                }, timeout);
                dom.window.addEventListener(eventName, resolveHtml);
                dom.window.addEventListener(eventName, () => clearTimeout(eventTimeout));
            }

            dom.window.eval(script);

            if (!eventName)resolveHtml();

            function resolveHtml() {
                let html = dom.serialize();
                resolve(html);
                dom.window.close();
            }

        } catch (err) { };
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
}