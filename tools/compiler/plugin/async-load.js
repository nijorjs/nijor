import GenerateID from '../../../utils/uniqeid.js';
import { minifyHTML } from '../../../utils/minify.js';

function getAttributesFromSpecs(specs) {
    // Remove curly braces or square brackets and split by comma
    return specs.replace(/^[{\[]|[}\]]$/g, '').split(',');
}

function runBlockComponents(element, scope) {
    let runFn = '';
    const regex = new RegExp(`\\w+_${scope}`);
    let childComponents = [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase()));

    childComponents.forEach(component => {
        let componentName = component.tagName.toLowerCase();
        let componentNameOriginal = componentName.split('_')[0];
        runFn += `$${componentNameOriginal}.init('${componentName}');await $${componentNameOriginal}.run();`;
    });

    return runFn;
}

function runForLoops(element, specs, variable) {
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

export default function (VirtualDocument, jsCode, jsCodeDefer, scope, specs, filename) {
    const allEligibleElements = VirtualDocument.window.document.querySelectorAll("div[n:async]");
    allEligibleElements.forEach(div => {
        const id = scope + GenerateID(3, 4);
        div.setAttribute('id', id);
        div.removeAttribute('n:async');

        const successBlock = div.getElementsByTagName('n:data')[0];
        const loadingBlock = div.getElementsByTagName('n:loading')[0];
        const errorBlock = div.getElementsByTagName('n:error')[0];

        process.ssrTemplate.add({id:id,content:loadingBlock.innerHTML});

        let [variable, asyncFunc] = successBlock.getAttribute('fetch').split(':');
        let errVar = errorBlock.getAttribute('catch') || `${scope}error`;
        let funcName = `${asyncFunc.split('(')[0]}_${scope}`;

        let RunComponentWithinSuccess = runBlockComponents(successBlock, scope);
        let RunComponentWithinError = runBlockComponents(errorBlock, scope);
        let RunComponentWithinLoading = runBlockComponents(loadingBlock, scope);

        let ForWithinSuccess = runForLoops(successBlock, specs, variable);
        let ForWithinError = runForLoops(errorBlock, specs, variable);
        let ForWithinLoading = runForLoops(loadingBlock, specs, variable);

        let loadFn = `
            async function ${funcName}(${specs}){
                const div${scope} = document.getElementById('${id}');
                try{
                    let ${variable} = await ${asyncFunc};
                    div${scope}.innerHTML = \`${minifyHTML(successBlock.innerHTML)}\`;
                    ${RunComponentWithinSuccess}
                    ${ForWithinSuccess}
                }catch(${errVar}){
                    div${scope}.innerHTML = \`${minifyHTML(errorBlock.innerHTML)}\`;
                    ${RunComponentWithinError}
                    ${ForWithinError}
                }
            }
        `;

        jsCode += loadFn;
        jsCodeDefer += `await ${funcName}(${specs});`;
        div.innerHTML = minifyHTML(loadingBlock.innerHTML);

        if (div.hasAttribute('n:reload')) {
            let reloadId = div.getAttribute('n:reload');
            div.setAttribute(`onreload-${reloadId}`, `window.eventStorage['${reloadId}@reload']()`);
            div.removeAttribute('n:reload');

            let getAttributes_reload = ``;

            if (specs) {
                getAttributesFromSpecs(specs).forEach(attr => {
                    div.setAttribute(`${attr}_`, "${" + attr + "}");
                    getAttributes_reload += `let ${attr} = div${scope}.getAttribute("${attr}_");`;
                });
            }

            jsCode += `window.eventStorage['${reloadId}@reload'] = async function() {
                const div${scope} = document.getElementById('${id}');
                ${getAttributes_reload}
                div${scope}.innerHTML=\`${minifyHTML(loadingBlock.innerHTML)}\`;
                ${RunComponentWithinLoading}
                ${ForWithinLoading}
                await ${funcName}(${specs});
            };`;
        }

    });

    let template = VirtualDocument.window.document.body.innerHTML;
    return { template, jsCode, jsCodeDefer };
}