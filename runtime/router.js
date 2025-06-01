import { dispatchEvent } from "./nijor.js";

window.nijor.routes = new Map();
window.nijor.routes.set("/",()=>{});

window.nijor.slots = new Map();
window.nijor.slots.set("/",()=>{});

window.nijor.redirect = function(route){
    window.nijor.previousRoute=window.location.pathname;
    try {
        history.pushState(null,null,route);
        history.pushState(null,null,route);
        history.back();
    } catch (error) {
        window.location.href=route;
    }
    return false;
};

window.addEventListener('popstate',async e =>{
    let path = e.target.location.pathname;

    await window.nijor.renderRoute(path);

    window.nijor.previousRoute = path;
    dispatchEvent('route',window.location.pathname);
});

window.nijor.setRoute = function(url,DynamicComponent,parentURL){
    window.nijor.routes.set(url,async(urlParameters)=>{
        try{
            let { default: Page} = await(DynamicComponent());
            let routesDiv = document.getElementById(`routes-slot-${parentURL}`);
            if(routesDiv){
                routesDiv.innerHTML="<app></app>";
            }else{
                await window.nijor.slots.get(`${parentURL}`)();
                document.getElementById(`routes-slot-${parentURL}`).innerHTML="<app></app>";
            }
            Page.init('app');
            await Page.run(urlParameters);
        }catch(e){} 
    });
}

window.nijor.addSlot = function(url,DynamicComponent){
    window.nijor.slots.set(url,async()=>{
        try{
            let { default: Page} = await(DynamicComponent());
            let routesDiv = document.getElementById('routes-slot-/');
            if(routesDiv){
                routesDiv.innerHTML="<app></app>";
            }
            Page.init('app');
            await Page.run();
        }catch(e){console.log(e)} 
    });
}

function Convert2Regex(route){
    // let regexpForAngularBrackets =  /<(.*?)>/g ;
    let regexpForSquareBrackets =  /\[(.*?)\]/g ;

    let allVars = route.match(regexpForSquareBrackets);
    
    allVars.forEach(el => {
        route = route.replace(el,'(.*)');
    });

    return new RegExp(route);
    // :  <(.*?)>
    // :  \/docs\/(.*)\/(.*)\/
}

async function RenderRoutes(route){
    if(route.endsWith('/') && route!="/") route = route.substring(0, route.length-1); // convert /route/ to /route
    if(route.endsWith('.html')) {
        route = route.slice(0, -5); // convert /route.html to /route
        history.replaceState(null,null,route); // replace /route.html to /route in the address bar

    }
    if(window.nijor.routes.has(route)) return await window.nijor.routes.get(route)();
    return await RenderRouteWithVars(route,window.nijor.routes);
}

async function RenderSlots(route){
    if(route.endsWith('/') && route!="/") route = route.substring(0, route.length-1); // convert /route/ to /route
    if(window.nijor.slots.has(route)) return await window.nijor.slots.get(route)();
}

async function RenderRouteWithVars(url, map) {
    for (const [route,page] of map.entries()) {
        if(route instanceof RegExp){
            const res = route.exec(url);
            if (!res) continue;
            let vars = res.slice(1,res.length);
            if(vars[0].indexOf('/')>-1) continue;
            return await page(vars);
        }
    }
    await Render404(url);
}

async function Render404(route){
    if(route==="/") return;
    let fragments = route.split('/');
    if(fragments[fragments.length - 1]==="404") fragments.pop();
    fragments.pop();
    fragments.push('404');
    route = fragments.join('/');
    if(route.endsWith('/') && route!="/") route = route.substring(0, route.length-1);
    if(window.nijor.routes.has(route)) return await window.nijor.routes.get(route)();
    return await Render404(route);
}

window.nijor.renderRoute = RenderRoutes;
window.nijor.renderSlots = RenderSlots;