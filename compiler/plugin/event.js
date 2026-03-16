import * as acorn from 'acorn';
import { simple as walkSimple } from 'acorn-walk';
import MagicString from "magic-string";

function getElementsWithOnEventAttributes(doc) {
    return Array.from(doc.querySelectorAll('*')).filter(el =>
        Array.from(el.attributes).some(attr => /^on:\w+$/.test(attr.name))
    );
}

let registeredFunctions = [];

function registerGlobalFunction(funcExpr, scope) {
    const match = funcExpr.match(/(\w+)\s*\(/);
    if (!match) return '';
    const name = match[1];
    const marker = `${name}@${scope}`
    if(registeredFunctions.includes(`${marker}`)) return '';
    registeredFunctions.push(`${name}@${scope}`);
    return `window.eventStorage['${marker}'] = ${name};`;
}

function registerFunction(funcExpr, scope) {
    const isAwait = /^\s*await\s+/.test(funcExpr);
    const cleanExpr = funcExpr.replace(/^\s*await\s+/, '');
    const match = cleanExpr.match(/(\w+)\s*\((.*?)\)/);
    if (!match) return '';

    const name = match[1];
    const wrapper = isAwait ? `async (...args)=> await ${name}(...args, $);` : `(...args)=> ${name}(...args, $);`;

    const marker = `${name}@${scope}:\${$id}`;
    if(registeredFunctions.includes(`${marker}`)) return '';
    registeredFunctions.push(marker);

    return `
if(!window.eventStorage[\`${marker}\`]) 
window.eventStorage[\`${marker}\`] = ${wrapper}`;
}

function rewriteCall(fnCall, scope, isStateFunction = false) {
    return fnCall.replace(
        /(\breturn\s*\(?\s*)?(await\s*)?(\w+)\s*\(/,
        (_, returnPrefix = '', awaitPrefix = '', name) => {
            const key = isStateFunction
                ? `${name}@${scope}:\${$id}`
                : `${name}@${scope}`;
            return `${returnPrefix}${awaitPrefix}window.eventStorage['${key}'](`;
        }
    );
}

function getFunctionName(expr) {
    const clean = expr.replace(/^\s*await\s+/, '');
    const match = clean.match(/(\w+)\s*\(/);
    return match ? match[1] : null;
}

function hasStateAsLastParam(jsString, fnName) {
    let ast;
    try {
        ast = acorn.parse(jsString, {
            ecmaVersion: 'latest',
            sourceType: 'module',
        });
    } catch {
        return false;
    }

    let found = false;

    walkSimple(ast, {
        FunctionDeclaration(node) {
            if (node.id?.name === fnName) {
                found = checkParams(node.params);
            }
        },
        VariableDeclarator(node) {
            if (node.id?.name === fnName) {
                const init = node.init;
                if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
                    found = checkParams(init.params);
                }
            }
        },
        Property(node) {
            const key = node.key?.name ?? node.key?.value;
            if (key === fnName) {
                const val = node.value;
                if (val?.type === 'FunctionExpression' || val?.type === 'ArrowFunctionExpression') {
                    found = checkParams(val.params);
                }
            }
        },
        MethodDefinition(node) {
            const key = node.key?.name ?? node.key?.value;
            if (key === fnName) {
                found = checkParams(node.value.params);
            }
        },
    });

    return found;
}

function checkParams(params) {
    if (!params?.length) return false;
    return resolveParamName(params[params.length - 1]) === '$';
}

function resolveParamName(param) {
    switch (param?.type) {
        case 'Identifier':
            return param.name;
        case 'AssignmentPattern':
            return resolveParamName(param.left);
        case 'RestElement':
            return resolveParamName(param.argument);
        default:
            return null;
    }
}

function extractFunction(code, functionName) {
    // ── 1. Parse
    const ast = acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "module",
        locations: true,
    });

    // ── 2. Walk the AST looking for the target function
    let start = null;
    let end = null;

    walkSimple(ast, {
        // function foo() {}
        FunctionDeclaration(node) {
            if (node.id && node.id.name === functionName) {
                start = node.start;
                end = node.end;
            }
        },

        // const foo = function() {}  |  const foo = () => {}
        VariableDeclaration(node) {
            for (const declarator of node.declarations) {
                if (
                    declarator.id &&
                    declarator.id.name === functionName &&
                    declarator.init &&
                    (declarator.init.type === "FunctionExpression" ||
                        declarator.init.type === "ArrowFunctionExpression")
                ) {
                    // Grab the whole `const foo = ...` statement
                    start = node.start;
                    end = node.end;
                }
            }
        },

        // { foo() {} }  (object method shorthand)
        Property(node) {
            if (
                node.key &&
                node.key.name === functionName &&
                node.value &&
                node.value.type === "FunctionExpression"
            ) {
                start = node.start;
                end = node.end;
            }
        },

        // class C { foo() {} }
        MethodDefinition(node) {
            if (node.key && node.key.name === functionName) {
                start = node.start;
                end = node.end;
            }
        },
    });

    if (start === null) {
        return { extracted: "", remainder: code };
    }

    // ── 3. Extract & remove using MagicString ───────────────────────────────────
    const ms = new MagicString(code);

    // Consume the trailing newline so we don't leave a blank line behind
    let removeEnd = end;
    if (code[removeEnd] === "\n") removeEnd += 1;

    const extracted = code.slice(start, end);
    ms.remove(start, removeEnd);

    const remainder = ms.toString();

    return { extracted, remainder };
}

export default function ({ document, scope, scripts }) {
    getElementsWithOnEventAttributes(document).forEach(el => {
        const events = el.getAttributeNames().filter(a => a.startsWith('on:'));

        events.forEach(attr => {
            const handler = el.getAttribute(attr);
            el.removeAttribute(attr);

            const fnName = getFunctionName(handler);
            if (!fnName) return;

            const { extracted, remainder } = extractFunction(scripts.main, fnName);
            scripts.main = remainder;
            scripts.global += extracted;

            const isStateFunction = hasStateAsLastParam(scripts.global, fnName);

            const rewrittenCall = rewriteCall(handler, scope, isStateFunction);

            if (isStateFunction) {
                scripts.main += registerFunction(handler, scope);
            } else {
                scripts.global += registerGlobalFunction(handler, scope);
            }

            el.setAttribute(attr.replace('on:', 'on'), rewrittenCall);
        });
    });

    return ({
        name: "Event Handler",
        data:{
        body: document.body.innerHTML,
        ...scripts
        }
    });
}