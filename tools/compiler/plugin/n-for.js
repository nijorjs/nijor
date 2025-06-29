import GenerateID from '../../../utils/uniqeid.js';
import { minifyHTML } from "../../../utils/minify.js";

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

function getAttributesFromSpecs(specs) {
    // Remove curly braces or square brackets and split by comma
    return specs.replace(/^[{\[]|[}\]]$/g, '').split(',');
}

function extractTemplateWords(str, omit = []) {
    const regex = /\${(.*?)}/g;
    let matches = [];
    let match;

    while ((match = regex.exec(str)) !== null) {
        if (!omit.includes(match[1])) {
            matches.push(match[1]);
        }
    }

    return `{${matches.join(", ")}}`;
}

export default function (VirtualDocument, jsCode, jsCodeDefer, scope, specs, filename) {
    const allEligibleElements = VirtualDocument.window.document.querySelectorAll("[n:for]");
    allEligibleElements.forEach(element => {
        let { variable, source } = parseCondition(element.getAttribute('n:for'), filename);
        let innerContent = element.innerHTML;

        const fnName = `f${scope}${GenerateID(3, 4)}`;
        let runComponents = '';

        const id = scope + GenerateID(3, 4);
        element.setAttribute('id', id);
        element.removeAttribute('n:for');
        element.setAttribute('n-for', fnName);
        
        process.ssrTemplate.add({id:id,content:''});

        const regex = new RegExp(`\\w+_${scope}`);

        let childComponents = [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase()));

        childComponents.forEach(component => {
            let componentName = component.tagName.toLowerCase();
            let componentNameOriginal = componentName.split('_')[0];
            runComponents += `$${componentNameOriginal}.init('${componentName}');await $${componentNameOriginal}.run();`;
        });

        element.innerHTML = '';

        const argumentsForFunction = extractTemplateWords(innerContent, [variable]);

        let fn = `
            async function ${fnName}(${argumentsForFunction}){
                const div${scope} = document.getElementById('${id}');
                try{
                    for(let ${variable} of ${source}){
                        div${scope}.innerHTML += \`${minifyHTML(innerContent)}\`;
                        ${runComponents}
                    }
                }catch($err${scope}){
                    div${scope}.innerHTML += "An Error occured !";
                }
            }
        `;

        jsCode += fn;
        element.setAttribute('nfor-arguments',`${argumentsForFunction}`);

        if (element.hasAttribute('n:reload')) {
            const reloadId = element.getAttribute('n:reload');
            element.removeAttribute('n:reload');
            element.setAttribute(`onreload-${reloadId}`, `window.eventStorage['${reloadId}@reload']()`);

            let getAttributes_reload = ``;

            getAttributesFromSpecs(argumentsForFunction).forEach(attr => {
                if(attr==="") return;
                element.setAttribute(`${attr}_`, "${" + attr + "}");
                getAttributes_reload += `let ${attr} = div${scope}.getAttribute("${attr}_") || "{${attr}}";`;
            });

            jsCode += `window.eventStorage['${reloadId}@reload'] = async function() {
                const div${scope} = document.getElementById('${id}');
                ${getAttributes_reload}
                div${scope}.innerHTML="";
                await ${fnName}(${argumentsForFunction});
            };`;

        }

    });
    let template = VirtualDocument.window.document.body.innerHTML;

    return { template, jsCode, jsCodeDefer };
}