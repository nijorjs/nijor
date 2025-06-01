function getElementsWithOnEventAttributes(doc) {
    const elements = doc.querySelectorAll('*'); // Get all elements
    return Array.from(elements).filter(el => {
        return Array.from(el.attributes).some(attr => /^on:\w+$/.test(attr.name));
    });
}

function transformFunction(jsCode, funcName, scope) {
    const match = funcName.match(/(\w+)\s*\((.*?)\)/); // Extract function name and arguments
    if (!match) return jsCode; // Return original code if no match

    const actualFuncName = match[1]; // Extracted function name

    // Regular expression to match both normal and async function definitions
    const funcRegex = new RegExp(`(async\\s+)?function\\s+${actualFuncName}\\s*\\((.*?)\\)\\s*{([\\s\\S]*?)}\\s*$`, 'm');

    return jsCode.replace(funcRegex, (_, asyncKeyword, args, body) => {
        asyncKeyword = asyncKeyword ? 'async ' : ''; // Preserve async if it exists
        return `window.eventStorage['${actualFuncName}@${scope}'] = ${asyncKeyword}function(${args}) {${body}}`;
    });
}

function replaceFunctionCalls(jsCode, originalFuncName, newFuncName) {
    let output = '';
    let isString = false;
    let quoteChar = '';
    let isComment = false;

    for (let i = 0; i < jsCode.length; i++) {
        let char = jsCode[i];
        let nextChar = jsCode[i + 1];

        // Handle string boundaries
        if (!isComment) {
            if ((char === '"' || char === "'" || char === '`') && (i === 0 || jsCode[i - 1] !== '\\')) {
                if (!isString) {
                    isString = true;
                    quoteChar = char;
                } else if (quoteChar === char) {
                    isString = false;
                }
            }
        }

        // Handle comments
        if (!isString) {
            if (!isComment && char === '/' && nextChar === '/') {
                isComment = true;
            } else if (isComment && char === '\n') {
                isComment = false;
            }
        }

        // Check for function call outside strings/comments
        if (!isString && !isComment) {
            if (jsCode.slice(i, i + originalFuncName.length + 1) === `${originalFuncName}(`) {
                output += `${newFuncName}(`;
                i += originalFuncName.length;
                continue;
            }
        }

        output += char;
    }

    return output;
}

function transformFunctionCall(funcCall,scope) {
    return funcCall.replace(/(\breturn\s*\(?\s*)?(await\s*)?(\w+)\s*\(/, (match, returnPrefix = '', awaitPrefix = '', funcName) => {
        return `${returnPrefix || ''}${awaitPrefix || ''}window.eventStorage['${funcName}@${scope}'](`;
    });
}

export default function (VirtualDocument,jsCode,jsCodeDefer,scope){

    const elementsWithEvents = getElementsWithOnEventAttributes(VirtualDocument.window.document);

    elementsWithEvents.forEach(child=>{
        const Events = child.getAttributeNames().filter(element=>element.indexOf('on:')>-1);

        Events.forEach(event=>{
            let fnName = child.getAttribute(event);
            let funcCall = transformFunctionCall(fnName,scope);

            jsCode = transformFunction(jsCode, fnName, scope);
            jsCode = replaceFunctionCalls(jsCode, fnName.split('(')[0], funcCall.split('(')[0]);
            jsCodeDefer = replaceFunctionCalls(jsCodeDefer, fnName.split('(')[0], funcCall.split('(')[0]);
            
            child.setAttribute(event.replace('on:','on'),funcCall);
            child.removeAttribute(event);
        });
    
    });

    return({
        template: VirtualDocument.window.document.body.innerHTML, 
        jsCode: jsCode,
        jsCodeDefer: jsCodeDefer
    });
}