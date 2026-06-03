import * as acorn from 'acorn';
import { simple as walk } from 'acorn-walk';

/* ------------------------- DOM Utilities ------------------------- */

function getEventElements(doc) {
    return [...doc.querySelectorAll('*')].filter(el =>
        [...el.attributes].some(attr => /^on:\w+$/.test(attr.name))
    );
}

/* ------------------------- Function Registry ------------------------- */

function buildMarker(name) {
    return `${name}@\${$id}`;
}

function registerHandler(fnName, scope, { awaitable = false, stateful = false } = {}) {
    const marker = buildMarker(fnName);

    if (stateful && awaitable) return `__${scope}__.addEventHandler(\`${marker}\`, ${fnName}, true, true);`;

    if (stateful) return `__${scope}__.addEventHandler(\`${marker}\`, ${fnName}, true);`;

    return `__${scope}__.addEventHandler(\`${marker}\`, ${fnName});`;
}

/* ------------------------- Parsing Utilities ------------------------- */

function extractFunctionName(expr) {
    const clean = expr.replace(/^\s*await\s+/, '');
    return clean.match(/(\w+)\s*\(/)?.[1] || null;
}

function isAwaitExpression(expr) {
    return /^\s*await\s+/.test(expr);
}

function rewriteCall(expr) {
    return expr.replace(
        /(\breturn\s*\(?\s*)?(await\s*)?(\w+)\s*\(/,
        (_, ret = '', aw = '', name) => {
            return `${ret}${aw}window.nijor.bucket['${buildMarker(name)}'](`;
        }
    );
}

/* ------------------------- AST Analysis ------------------------- */

function hasStateParam(js, fnName) {
    let ast;
    try {
        ast = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch {
        return false;
    }

    let found = false;

    const check = params =>
        params?.length &&
        resolveParam(params.at(-1)) === '$';

    walk(ast, {
        FunctionDeclaration(node) {
            if (node.id?.name === fnName) {
                found = check(node.params);
            }
        },
        VariableDeclarator(node) {
            if (node.id?.name !== fnName) return;
            const fn = node.init;
            if (isFunction(fn)) found = check(fn.params);
        },
        Property(node) {
            const key = node.key?.name ?? node.key?.value;
            if (key !== fnName) return;
            if (isFunction(node.value)) {
                found = check(node.value.params);
            }
        },
        MethodDefinition(node) {
            const key = node.key?.name ?? node.key?.value;
            if (key === fnName) {
                found = check(node.value.params);
            }
        }
    });

    return found;
}

function isFunction(node) {
    return node?.type === 'ArrowFunctionExpression' ||
           node?.type === 'FunctionExpression';
}

function resolveParam(param) {
    switch (param?.type) {
        case 'Identifier': return param.name;
        case 'AssignmentPattern': return resolveParam(param.left);
        case 'RestElement': return resolveParam(param.argument);
        default: return null;
    }
}

/* ------------------------- Main Transformer ------------------------- */

export default function ({ document, scope, scripts }) {
    const elements = getEventElements(document);

    elements.forEach(el => {
        const events = el.getAttributeNames().filter(a => a.startsWith('on:'));

        events.forEach(attr => {
            const handler = el.getAttribute(attr);
            el.removeAttribute(attr);

            const fnName = extractFunctionName(handler);
            if (!fnName) return;

            const stateful = hasStateParam(scripts.global, fnName);
            const awaitable = isAwaitExpression(handler);

            const registration = registerHandler(fnName, scope, {
                awaitable,
                stateful
            });

            if (registration) {
                scripts.main += `\n${registration}`;
            }

            const rewritten = rewriteCall(handler);
            el.setAttribute(attr.replace('on:', 'on'), rewritten);
        });
    });

    return {
        name: "Event Handler",
        data: {
            body: document.body.innerHTML,
            ...scripts
        }
    };
}