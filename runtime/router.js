import { dispatchEvent } from "./nijor.js";

const Routes = new Map();
const Slots = new Map();
Slots.set("/", () => { });

window.nijor.redirect = route => {
    window.nijor.previousRoute = window.location.pathname;
    try {
        history.pushState(null, null, route);
        history.pushState(null, null, route);
        history.back();
    } catch (error) {
        window.location.href = route;
    }
    return false;
};

window.addEventListener('popstate', async e => {
    let path = e.target.location.pathname;

    await RenderRoute(path);

    window.nijor.previousRoute = path;
    dispatchEvent('route', window.location.pathname);
});

async function Render404(url) {
    if (url === "/") return;
    let fragments = url.split('/');
    if (fragments[fragments.length - 1] === "404") fragments.pop();
    fragments.pop();
    fragments.push('404');
    url = fragments.join('/');
    if (url.endsWith('/') && url != "/") url = url.substring(0, url.length - 1);
   
    for (const [route, page] of Routes.entries()) {
        const match = url.match(route.pattern);
        if (match) {
            // Extract parameters
            const params = {};
            route.params.forEach((name, index) => { params[name] = match[index + 1]; });

            await page(params);
            return true;
        }
    }

    return await Render404(url);
}

async function RenderRoute(url) {
    url = url.split('?')[0];
    if (url.endsWith('/') && url != "/") url = url.substring(0, url.length - 1); // convert /route/ to /route

    if (url.endsWith('.html')) {
        url = url.slice(0, -5); // convert /route.html to /route
        history.replaceState(null, null, url); // replace /route.html to /route in the address bar
    }

    for (const [route, page] of Routes.entries()) {
        const match = url.match(route.pattern);
        if (match) {

            const params = {};
            route.params.forEach((name, index) => { params[name] = match[index + 1]; });

            await page(params);
            return true;
        }
    }

    await Render404(url);
}

window.nijor.setRoute = function (urlData, DynamicComponent, parentURL) {

    Routes.set(urlData, async (params) => {

        try {
            let { default: Page } = await DynamicComponent();
            let routesDiv = document.getElementById(`routes-slot-${parentURL}`);

            if (!routesDiv) {
                await Slots.get(`${parentURL}`)(params);
            }

            await Page.render(`routes-slot-${parentURL}`,params);
        } catch (e) {}

    });

}

window.nijor.addSlot = function(url,DynamicComponent){
    Slots.set(url,async(params)=>{
        try{
            let { default: Page} = await DynamicComponent();
            await Page.render('routes-slot-/',params);
        }catch(e){} 
    });
}

window.nijor.renderRoute = RenderRoute;