export function runComponents(element, scope) {
    let runFn = '';
    const regex = new RegExp(`\\w+_${scope}`);
    let childComponents = [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase()));

    childComponents.forEach(component => {
        let componentName = component.tagName.toLowerCase();
        let componentNameOriginal = componentName.split('_')[0];
        runFn += `$${componentNameOriginal}.init('${componentName}');await $${componentNameOriginal}.run();`;
    });

    return [runFn, childComponents.length];
}

export function runForLoops(element, specs, variable) {
    let str = ``;
    element.querySelectorAll('[n-for]').forEach(el => {
        let fn = el.getAttribute('n-for');
        el.removeAttribute('n-for');
        if (specs) {
            str += `await ${fn}(${variable},...${specs});`;
        } else {
            str += `await ${fn}({${variable},...{}});`;
        }
    });
    return str;
}

export function runAsyncData(element, specs) {
    let str = ``;
    element.querySelectorAll('[n-async-func]').forEach(el => {
        let fn = el.getAttribute('n-async-func');
        str += `await ${fn}(${specs});`;
    });
    return str;
}

export default function(element,specs,scope){
    let _async = true;
    let [$components,noComponents] = runComponents(element,scope);
    // let $async = runAsyncData(element,specs);
    let $loops = runForLoops(element,specs);

    if(noComponents===0) _async = false;
    // if($async==='') _async = false;
    if($loops==='') _async = false;

    return [$components + $loops,_async];
}