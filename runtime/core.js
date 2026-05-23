// window.nijor is an object used by Nijor during runtime.
// window.nijor.bucket is an object that stores all the events like on:click="clicked()" (on:{event}="func()") 
window.nijor = { 
    root: document.body, 
    layout: null,
    bucket: {}, // Stores all the event handlers and state update functions
    bucket_size: 0, // Used to track the size of the bucket for cleanup
}

function Hydrate() {
    const hydrationTemplate = document.head.querySelector("script[type='hydration']");
    if (!hydrationTemplate) return;
    const script = document.createElement('script');
    script.setAttribute('type', 'module');
    script.innerHTML = hydrationTemplate.innerHTML;
    document.head.appendChild(script);
    document.head.removeChild(hydrationTemplate);
}

export let cleanupFunctions = []; // Stores all the functions to be run on cleanup of page + components

export const onCleanup = fn => cleanupFunctions.push(fn);
export const resetCleanup = () => cleanupFunctions = [];

export async function Render(root) {
    if (root) window.nijor.root = root;
    // if(document.body.hasAttribute('rendered')) {
    //     Hydrate();
    //     return;
    // }
    await window.nijor.initialRender(window.location.pathname + window.location.search + window.location.hash);
}