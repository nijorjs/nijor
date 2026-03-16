// window.nijor is an object used by Nijor during runtime.
// window.eventStorage is an object that stores all the events like on:click="clicked()" (on:{event}="func()") 
window.nijor = { root : document.body, layout : null };
window.eventStorage = { };

function Hydrate(){
    const hydrationTemplate = document.head.querySelector("script[type='hydration']");
    if(!hydrationTemplate) return;
    const script = document.createElement('script');
    script.setAttribute('type','module');
    script.innerHTML = hydrationTemplate.innerHTML;
    document.head.appendChild(script);
    document.head.removeChild(hydrationTemplate);
}

export async function Render(root){
    if(root) window.nijor.root = root;
    // if(document.body.hasAttribute('rendered')) {
    //     Hydrate();
    //     return;
    // }
    await window.nijor.initialRender(window.location.pathname);
}