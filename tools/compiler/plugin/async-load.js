import GenerateID from '../../../utils/uniqeid.js';
import { minifyHTML } from '../../../utils/minify.js';
import { runComponents } from './sandbox.js';

function getAttributesFromProps(props) {
    // Remove curly braces or square brackets and split by comma
    return props.replace(/^[{\[]|[}\]]$/g, '').split(',');
}

export default function (VirtualDocument, jsCode, jsCodeDefer, scope, props, filename) {
    const allEligibleElements = VirtualDocument.window.document.querySelectorAll("div[n:async]");
    allEligibleElements.forEach(div => {
        const id = scope + GenerateID(3, 4);
        div.setAttribute('id', id);
        div.removeAttribute('n:async');

        const successBlock = div.getElementsByTagName('n:data')[0];
        const loadingBlock = div.getElementsByTagName('n:loading')[0];
        const errorBlock = div.getElementsByTagName('n:error')[0];

        let [variable, asyncFunc] = successBlock.getAttribute('fetch').split(':');
        let errVar = errorBlock.getAttribute('catch') || `${scope}error`;
        let funcName = `${asyncFunc.split('(')[0]}_${scope}`;

        let RunComponentWithinSuccess = runComponents(successBlock, scope)[0];
        let RunComponentWithinError = runComponents(errorBlock, scope)[0];
        let RunComponentWithinLoading = runComponents(loadingBlock, scope)[0];

        let loadFn = `
            window.eventStorage['${funcName}'] = async function (${props}){
                if(window.location.protocol==='nijor:') return;
                const div${scope} = document.getElementById('${id}');
                try{
                    let ${variable} = await ${asyncFunc};
                    div${scope}.innerHTML = \`${minifyHTML(successBlock.innerHTML)}\`;
                    ${RunComponentWithinSuccess}
                }catch(${errVar}){
                    div${scope}.innerHTML = \`${minifyHTML(errorBlock.innerHTML)}\`;
                    ${RunComponentWithinError}
                }
            }
        `;

        jsCode += loadFn;
        jsCodeDefer += `await window.eventStorage['${funcName}'](${props});`;
        div.innerHTML = minifyHTML(loadingBlock.innerHTML);

        let getAttributes_reload = "";
        if (props) {
            getAttributesFromProps(props).forEach(attr => {
                div.setAttribute(`${attr}_`, "${" + attr + "}");
                getAttributes_reload += `let ${attr} = div${scope}.getAttribute("${attr}_");`;
            });
        }

        let csrHydrationScript = `
        ${getAttributes_reload==="" ? "" :`const div${scope} = document.getElementById('${id}');`}
        ${getAttributes_reload}
        await window.eventStorage['${funcName}'](${props});
        `;

        if (div.hasAttribute('n:reload')) {
            let reloadId = div.getAttribute('n:reload');
            div.setAttribute(`onreload-${reloadId}`, `window.eventStorage['${reloadId}@reload']()`);
            div.removeAttribute('n:reload');

            jsCode += `window.eventStorage['${reloadId}@reload'] = async function() {
                const div${scope} = document.getElementById('${id}');
                ${getAttributes_reload}
                div${scope}.innerHTML=\`${minifyHTML(loadingBlock.innerHTML)}\`;
                ${RunComponentWithinLoading}
                await window.eventStorage['${funcName}'](${props});
            };`;

            csrHydrationScript = `window.eventStorage['${reloadId}@reload']();`;
        }

        if (div.hasAttribute('n:server')){

            const propsArray = props2Array(props);
            const success = minifyHTML(formatProps(successBlock.innerHTML,propsArray));
            const failure = minifyHTML(formatProps(errorBlock.innerHTML,propsArray));

            let $fetchFn = asyncFunc.split('(')[0]+'_'+scope+'('+asyncFunc.split('(')[1];
            let $server_code = `
                try{
                    let ${variable} = await ${$fetchFn};
                    data_${process.seed} = \`${success}\`;
                }catch(${errVar}){
                    data_${process.seed} = \`${failure}\`;
                }
                
                html_${process.seed} = renderTemplates_${process.seed}(html_${process.seed},data_${process.seed},'${id}');
            `;

            let $fetch = extractAndRenameFunction(jsCode,asyncFunc.split('(')[0],scope);
            process.serverFunctions += $fetch;

            let hydrationFunction = `
            window.eventStorage['server:${funcName}'] = async ()=>{
                ${getAttributes_reload==="" ? "" :`const div${scope} = document.getElementById('${id}');`}
                ${getAttributes_reload}
                ${RunComponentWithinSuccess}
                ${RunComponentWithinError}
            }
            `;

            let hydartionScript = `await window.eventStorage['server:${funcName}']();`;

            if(RunComponentWithinSuccess=="" && RunComponentWithinError==""){
                hydrationFunction = '';
                hydartionScript = null;
            }

            process.staticTemplate.add({
                type:'ssr',
                data:{
                    id:id,
                    content:`<!--@[${id}]-->`,
                    script:hydartionScript,
                    server: $server_code,
                    params: props !=="" ? props : null
                }
            });

            jsCode+= hydrationFunction;
        }

        if(!div.hasAttribute('n:server')){
            process.staticTemplate.add({
            type:'csr',
                data:{
                    id:id,
                    content:null,
                    script:csrHydrationScript
                }
            });
        }

        if(div.hasAttribute('n:server')) div.removeAttribute('n:server');

    });

    let template = VirtualDocument.window.document.body.innerHTML;
    return { template, jsCode, jsCodeDefer };
}

function extractAndRenameFunction(jscode, fnc, scope) {
    const fncRegex = new RegExp(
        `(async\\s+)?function\\s+${fnc}\\s*\\([^)]*\\)\\s*{`,
        'm'
    );

    const match = fncRegex.exec(jscode);
    if (!match) return null;

    const startIdx = match.index;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let escaped = false;
    let endIdx = -1;

    for (let i = startIdx; i < jscode.length; i++) {
        const char = jscode[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === stringChar) {
                inString = false;
            }
            continue;
        } else if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
            continue;
        }

        if (char === '{') {
            braceCount++;
            if (braceCount === 1 && i !== startIdx + match[0].length - 1) break; // not the opening brace of the function
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }

    if (endIdx === -1) return null;

    const originalFunction = jscode.slice(startIdx, endIdx);
    const renamedFunction = originalFunction.replace(
        new RegExp(`function\\s+${fnc}\\b`),
        `function ${fnc}_${scope}`
    );

    return renamedFunction;
}

function props2Array(props) {
    if (!/^\{.*\}$/.test(props)) return [];  // return [] if the format is invalid
    const arr =  props.slice(1, -1).split(",").map(s => s.trim()).filter(s => s.length > 0);
    return arr;
}

function formatProps(str, wordArray) {
    return str.replace(/(?<!\\)\$\{(.*?)\}/g, (match, word) => {
        return wordArray.includes(word) ? `[${word}]` : match;
    });
}