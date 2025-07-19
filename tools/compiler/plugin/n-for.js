import GenerateID from '../../../utils/uniqeid.js';
import { minifyHTML } from '../../../utils/minify.js';
import { runComponents } from './sandbox.js';

function parseCondition(condition, filename) {
    const regex = /(\w+)\s+in\s+(.*)/;
    const match = condition.match(regex);

    if (!match) {
        process.quitCompiler(`Invalid condition format in ${filename}`);
    }

    const variable = match[1];
    let source = match[2].trim();

    // Identify if source is an async operation
    const isAsync = source.startsWith("await ");

    // Remove "await" if present
    if (isAsync) {
        source = source.replace(/^await\s+/, "");
    }

    return { variable, source, isAsync };
}

function getAttributesFromProps(props) {
    // Remove curly braces or square brackets and split by comma
    return props.replace(/^[{\[]|[}\]]$/g, '').split(',');
}

function extractTemplateWords(str, omit = []) {
    const regex = /\${([^}\[.]*?)(?:\[.*?\]|\.[^}]*)?}/g;
    let matches = new Set();
    let match;

    while ((match = regex.exec(str)) !== null) {
        if (!omit.includes(match[1])) {
            matches.add(match[1]);
        }
    }

    return `{${[...matches].join(", ")}}`;
}

export default function (VirtualDocument, jsCode, jsCodeDefer, scope, props, filename) {
    const allEligibleElements = VirtualDocument.window.document.querySelectorAll("[n:for]");
    allEligibleElements.forEach(element => {
        let { variable, source } = parseCondition(element.getAttribute('n:for'), filename);
        let innerContent = element.innerHTML;

        const fnName = `f${scope}${GenerateID(3, 4)}`;
        const $run_inside = runComponents(element,scope)[0];

        const id = scope + GenerateID(3, 4);
        const className = 'f'+id.toLowerCase();
        element.classList.add(className);
        element.removeAttribute('n:for');
        element.setAttribute('n-for', fnName);
        element.innerHTML = '';

        const argumentsForFunction = extractTemplateWords(innerContent, [variable]);

        let getAttributes_reload = ``;
        getAttributesFromProps(argumentsForFunction).forEach(attr => {
            if(attr==="") return;
            element.setAttribute(`${attr}_`, "${" + attr + "}");
            getAttributes_reload += `let ${attr} = div${scope}.getAttribute("${attr}_") || "{${attr}}";`;
        });

        let fn = `
            window.eventStorage['${fnName}'] = async function (){
                document.querySelectorAll('.${className}').forEach(async div${scope}=>{
                    if (div${scope}.classList.contains('exc-${className}')) return;
                    try{
                        ${getAttributes_reload}
                        div${scope}.innerHTML = "";

                        for(let ${variable} of ${source}){
                            div${scope}.innerHTML += \`${minifyHTML(innerContent)}\`;
                            ${$run_inside}
                        }
                        div${scope}.classList.add('exc-${className}');
                    }catch($err${scope}){ div${scope}.innerHTML += "An Error occured !"; }
                    
                });
            }
        `;

        jsCode += fn;

        if (element.hasAttribute('n:reload')) {
            const reloadId = element.getAttribute('n:reload');
            element.removeAttribute('n:reload');
            element.setAttribute(`onreload-${reloadId}`, `window.eventStorage['${reloadId}@reload']()`);

            jsCode += `window.eventStorage['${reloadId}@reload'] = async function() {
                document.querySelectorAll('.${className}').forEach(div${scope}=>{ div${scope}.classList.remove('exc-${className}'); });
                await window.eventStorage['${fnName}']();
            };`;

        }

    });


    let template = VirtualDocument.window.document.body.innerHTML;

    return { template, jsCode, jsCodeDefer };
}

function isInsideNData(document,element) {
    let current = element;
    while (current && current !== document) {
        if (current.tagName.toLowerCase() === 'n:data') {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}