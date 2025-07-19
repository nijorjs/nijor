import GenerateID from '../../../utils/uniqeid.js';
import { minifyHTML } from '../../../utils/minify.js';
import { runComponents } from './sandbox.js';

function getAttributesFromProps(props) {
    // Remove curly braces or square brackets and split by comma
    return props.replace(/^[{\[]|[}\]]$/g, '').split(',');
}

export default function (VirtualDocument, jsCode, jsCodeDefer, scope, props, filename) {
    const document = VirtualDocument.window.document;
    const allEligibleElements = document.querySelectorAll("div[n:fetch]");
    allEligibleElements.forEach(element => {
        const id = scope + GenerateID(3, 4);
        element.setAttribute('id', id);
        const [variable, asyncFunc] = element.getAttribute('n:fetch').split(':');
        element.removeAttribute('n:fetch');

        const successBlock = element.getElementsByTagName('n:data')[0];
        const loadingBlock = element.getElementsByTagName('n:loading')[0];
        const fallbackBlock = element.getElementsByTagName('n:error')[0];
        const loopBlock = successBlock.getElementsByTagName('n:loop')[0];

        let errVar = fallbackBlock.getAttribute('catch') || `${scope}error`;
        let funcName = `${asyncFunc.split('(')[0]}_${scope}`;

        let RunComponentWithinSuccess = runComponents(successBlock, scope)[0];
        let RunComponentWithinFallback = runComponents(fallbackBlock, scope)[0];
        let RunComponentWithinLoading = runComponents(loadingBlock, scope)[0];

        if(successBlock.hasAttribute('loop') && !loopBlock){
            jsCode+=`
            window.eventStorage['${funcName}'] = async function (${props}){
                if(document.body.hasAttribute('nijor-build')) return;
                const div${scope} = document.getElementById('${id}');
                try{
                    let content${scope}="";
                    for(let ${variable} of await ${asyncFunc}){
                        content${scope} += \`${minifyHTML(successBlock.innerHTML)}\`;
                    }
                    div${scope}.innerHTML = content${scope};
                    ${RunComponentWithinSuccess}
                }catch(${errVar}){
                    div${scope}.innerHTML = \`${minifyHTML(fallbackBlock.innerHTML)}\`;
                    ${RunComponentWithinFallback}
                }
            };`;
        }else if(successBlock.hasAttribute('loop') && loopBlock){
            const loopID = `${id}loop`;
            const { parentElement } = loopBlock;
            parentElement.replaceChild(document.createComment(loopID),loopBlock);
            
            jsCode+=`
            window.eventStorage['${funcName}'] = async function (${props}){
                if(document.body.hasAttribute('nijor-build')) return;
                const div${scope} = document.getElementById('${id}');
                try{
                    let content${scope}="";
                    for(let ${variable} of await ${asyncFunc}){
                        content${scope} += \`${minifyHTML(loopBlock.innerHTML)}\`;
                    }
                    div${scope}.innerHTML = \`${minifyHTML(successBlock.innerHTML)}\`.replace('<!--${loopID}-->',content${scope});
                    ${RunComponentWithinSuccess}
                }catch(${errVar}){
                    div${scope}.innerHTML = \`${minifyHTML(fallbackBlock.innerHTML)}\`;
                    ${RunComponentWithinFallback}
                }
            };`;

        }else{
            jsCode+=`
            window.eventStorage['${funcName}'] = async function (${props}){
                if(document.body.hasAttribute('nijor-build')) return;
                const div${scope} = document.getElementById('${id}');
                try{
                    let ${variable} = await ${asyncFunc};
                    div${scope}.innerHTML = \`${minifyHTML(successBlock.innerHTML)}\`;
                    ${RunComponentWithinSuccess}
                }catch(${errVar}){
                    div${scope}.innerHTML = \`${minifyHTML(fallbackBlock.innerHTML)}\`;
                    ${RunComponentWithinFallback}
                }
            };`;
        }

        jsCodeDefer += `await window.eventStorage['${funcName}'](${props});`;
        element.innerHTML = minifyHTML(loadingBlock.innerHTML);

        let getAttributes_reload = "";
        if (props) {
            getAttributesFromProps(props).forEach(attr => {
                element.setAttribute(`${attr}_`, "${" + attr + "}");
                getAttributes_reload += `let ${attr} = div${scope}.getAttribute("${attr}_");`;
            });
        }

        let csrHydrationScript = `
        ${getAttributes_reload==="" ? "" :`const div${scope} = document.getElementById('${id}');`}
        ${getAttributes_reload}
        await window.eventStorage['${funcName}'](${props});
        `;

        if (element.hasAttribute('n:reload')) {
            let reloadId = element.getAttribute('n:reload');
            element.setAttribute(`onreload-${reloadId}`, `window.eventStorage['${reloadId}@reload']()`);
            element.removeAttribute('n:reload');

            jsCode += `window.eventStorage['${reloadId}@reload'] = async function() {
                const div${scope} = document.getElementById('${id}');
                ${getAttributes_reload}
                div${scope}.innerHTML=\`${minifyHTML(loadingBlock.innerHTML)}\`;
                ${RunComponentWithinLoading}
                await window.eventStorage['${funcName}'](${props});
            };`;

            csrHydrationScript = `window.eventStorage['${reloadId}@reload']();`;
        }

        if (element.hasAttribute('n:server')){

            const propsArray = props2Array(props);
            const success = minifyHTML(formatProps(successBlock.innerHTML,propsArray));
            const failure = minifyHTML(formatProps(fallbackBlock.innerHTML,propsArray));

            let $fetchFn = asyncFunc.split('(')[0]+'_'+scope+'('+asyncFunc.split('(')[1];
            let $server_code = `
                let data_${scope} = "";
                try{
                    let ${variable} = await ${$fetchFn};
                    data_${scope} = \`${success}\`;
                }catch(${errVar}){
                    data_${scope} = \`${failure}\`;
                }
                
                html_${process.seed} = renderTemplates_${process.seed}(html_${process.seed},data_${scope},'${id}');
            `;

            if(successBlock.hasAttribute('loop') && !loopBlock){
                $server_code = `
                    let data_${scope} = "";
                    try{
                        for(let ${variable} of await ${$fetchFn}){
                            data_${scope} += \`${success}\`;
                        }
                    }catch(${errVar}){
                        data_${scope} = \`${failure}\`;
                    }
                    
                    html_${process.seed} = renderTemplates_${process.seed}(html_${process.seed},data_${scope},'${id}');
                `;
            }

            if(successBlock.hasAttribute('loop') && loopBlock){
                const loop = minifyHTML(formatProps(loopBlock.innerHTML,propsArray));
                $server_code = `
                    let data_${scope} = "";
                    try{
                        let content_${scope} = "";
                        for(let ${variable} of await ${$fetchFn}){
                            content_${scope} += \`${loop}\`;
                        }
                        data_${scope} = \`${success}\`.replace('<!--${id}loop-->',content_${scope});
                    }catch(${errVar}){
                        data_${scope} = \`${failure}\`;
                    }
                    
                    html_${process.seed} = renderTemplates_${process.seed}(html_${process.seed},data_${scope},'${id}');
                `;
            }

            let $fetch = extractAndRenameFunction(jsCode,asyncFunc.split('(')[0],scope);
            process.serverFunctions += $fetch;

            let hydrationFunction = `
            window.eventStorage['server:${funcName}'] = async ()=>{
                ${getAttributes_reload==="" ? "" :`const div${scope} = document.getElementById('${id}');`}
                ${getAttributes_reload}
                ${RunComponentWithinSuccess}
                ${RunComponentWithinFallback}
            }
            `;

            let hydartionScript = `await window.eventStorage['server:${funcName}']();`;

            if(RunComponentWithinSuccess=="" && RunComponentWithinFallback==""){
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

        if(!element.hasAttribute('n:server')){
            process.staticTemplate.add({
            type:'csr',
                data:{
                    id:id,
                    content:null,
                    script:csrHydrationScript
                }
            });
        }

        if(element.hasAttribute('n:server')) element.removeAttribute('n:server');

    });

    let template = document.body.innerHTML;
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