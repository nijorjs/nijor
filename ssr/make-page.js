import { JSDOM } from 'jsdom';
import path from 'path';

const RootPath = process.cwd();
const modulesPath = path.join(RootPath, 'assets/modules');

export async function BuildPage(template, script, url) {
    const host = 'http://nijorjs.github.io';
    const eventName = 'app-loaded'; // optional fallback
    const timeout = 500;

    const dom = new JSDOM(template, {
        runScripts: "outside-only",
        url: host + url
    });

    shimDom(dom);

    return new Promise(async (resolve) => {
        let resolved = false;

        function done() {
            if (resolved) return;
            resolved = true;
            resolveHtml(dom, resolve);
        }

        try {
            // Run user script (async-safe)
            await dom.window.eval(`(async () => { ${script} })()`);

            if (dom.window.__NIJOR_READY__) {
                try {
                    await dom.window.__NIJOR_READY__;
                    return done();
                } catch (e) {
                    console.error(e);
                    return done();
                }
            }

            if (eventName) {
                const timer = setTimeout(done, timeout);

                dom.window.addEventListener(eventName, () => {
                    clearTimeout(timer);
                    done();
                });
            }

            setTimeout(done, 20);

        } catch (err) {
            console.error(err);
            done();
        }
    });
}

function shimDom(dom) {
    const win = dom.window;

    win.rendering = true;

    win.alert = () => {};
    win.scrollTo = () => {};

    win.requestAnimationFrame = (fn) => setTimeout(fn, 0);
    win.cancelAnimationFrame = (id) => clearTimeout(id);

    win.requestIdleCallback = (fn) =>
        setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 50 }), 0);

    win.cancelIdleCallback = (id) => clearTimeout(id);

    // Core APIs
    win.TextEncoder = TextEncoder;
    win.TextDecoder = TextDecoder;
    win.fetch = fetch;

    // Media query stub
    win.matchMedia = () => ({
        matches: false,
        addEventListener: () => {}
    });
}

function resolveHtml(dom, resolve) {
    const route = dom.window.location.pathname;
    const { file } = process.sourceMap[route];

    let hydrationScript = dom.window.document.head.querySelector("script[type='hydration']");

    if (!hydrationScript) {
        hydrationScript = dom.window.document.createElement('script');
        hydrationScript.setAttribute('type', 'hydration');
        dom.window.document.head.appendChild(hydrationScript);
    }

    // Hydration imports
    hydrationScript.innerHTML += `await import('/modules/layout/${process.layoutMap.get(route)}.js');`;
    hydrationScript.innerHTML += `await import('/modules/${file}');`;

    // Metadata injection
    if (process.metadataMap.has(route)) {
        const metadata = process.metadataMap.get(route);
        dom.window.document.head.innerHTML += metadata;
    }

    // Clean body
    dom.window.document.body.removeAttribute('theme');
    dom.window.document.body.setAttribute('rendered', '');

    const html = dom.serialize();

    resolve(html);
    dom.window.close();
}