import { minifyHTML } from '../../utils/minify.js';
import uniqueid from '../../utils/uniqeid.js';

/* ------------------------- Helpers ------------------------- */

const isComponent = (tag, scope) => tag.endsWith(`_${scope}`);

const ensureId = (el, prefix = 'R') => {
    if (el.id) return el.id;
    const id = `${prefix}\${$id}${uniqueid(5, 7)}`;
    el.id = id;
    return id;
};

const addScript = (scripts, scope, code) => scripts.main += `\n${code}`;

const subscribe = (scope, variable, code) => `__${scope}__.subscribe('${variable}',()=>${code});`;

/* ------------------------- Reactive Attr Discovery ------------------------- */

function getReactiveElements(document) {
    return [...document.querySelectorAll('*')].filter(el => {
        const attrs = [...el.attributes].filter(a => a.name.startsWith('n:attr:')).map(a => a.name.slice(7));

        if (!attrs.length) return false;

        Object.defineProperty(el, 'r_attr', {
            get: () => attrs,
            configurable: true
        });

        return true;
    });
}

/* ------------------------- Component Handling ------------------------- */

function handleComponent(attrs, el, scripts, scope) {
    scripts.import.add(`import {reload as $reload_${scope}} from 'nijor/reactivity';`);

    const id = el.getAttribute('_id');
    const name = el.tagName.toLowerCase();

    attrs.forEach(attr => {
        const deps = el.getAttribute(`n:attr:${attr}`).split(" ");
        el.removeAttribute(`n:attr:${attr}`);
        deps.forEach(v => addScript(scripts, scope, subscribe(scope, v, `$reload_${scope}('${id}',$${name},'${name}',\`${el.outerHTML}\`)`)));
    });

    el.outerHTML = `<!--${id}-->${el.outerHTML}<!--/${id}-->`;
}

/* ------------------------- n:var ------------------------- */

function handleVars(document, scripts, scope) {
    document.querySelectorAll('[n\\:var]').forEach(el => {
        const vars = el.getAttribute('n:var').split(" ");
        const id = ensureId(el, '');
        const template = minifyHTML(el.innerHTML);

        el.removeAttribute('n:var');

        vars.forEach(v => {
            const target = el.tagName.toLowerCase() === 'textarea' ? `.value` : `.innerHTML`;
            addScript(scripts, scope, subscribe(scope, v, `document.getElementById(\`${id}\`)${target} = \`${template}\``));
        });
    });
}

/* ------------------------- n:attr ------------------------- */

function handleReactiveAttributes(document, scripts, scope) {
    getReactiveElements(document).forEach(el => {
        if (isComponent(el.tagName.toLowerCase(), scope)) {
            return handleComponent(el.r_attr, el, scripts, scope);
        }

        const id = ensureId(el);

        el.r_attr.forEach(attr => {
            const deps = el.getAttribute(`n:attr:${attr}`).split(" ");
            const value = el.getAttribute(attr);

            el.removeAttribute(`n:attr:${attr}`);

            deps.forEach(v => {
                if (/[.: -]/.test(attr)) return;
                addScript(scripts, scope, subscribe(scope, v, `document.getElementById(\`${id}\`).${attr} = \`${value}\``));
            });

        });
    });
}

/* ------------------------- Reactive Classes ------------------------- */

function handleClasses(document, scripts, scope) {
    document.querySelectorAll('[n\\:rclasses]').forEach(el => {
        const id = ensureId(el);
        const classes = el.getAttribute('n:rclasses').split(' ');

        el.removeAttribute('n:rclasses');

        classes.forEach(cls => {
            const deps = el.getAttribute(`n:rclass:${cls}`).split(' ');
            const condition = el.getAttribute(`n:rclass:${cls}:condition`);

            el.removeAttribute(`n:rclass:${cls}`);
            el.removeAttribute(`n:rclass:${cls}:condition`);

            deps.forEach(v => {
                addScript(
                    scripts,
                    scope,
                    `
__${scope}__.subscribe('${v}',()=>{
  const el = document.getElementById(\`${id}\`);
  if(${condition}) el?.classList.add('${cls}');
  else el?.classList.remove('${cls}');
});`
                );
            });
        });
    });
}

/* ------------------------- Bindings ------------------------- */

function handleBindings(document, scripts, scope) {
    document.querySelectorAll('[n:bind]').forEach((el, i) => {
        const id = ensureId(el);
        const tag = el.tagName.toLowerCase();

        const bind = el.getAttribute('n:bind');
        el.removeAttribute('n:bind');

        const isInput = ['input', 'textarea', 'select'].includes(tag) || el.getAttribute('contenteditable') === 'true';

        if (!isInput) return;

        const variable = bind.trim().slice(3, -1);
        const prop = tag === 'input' || tag === 'textarea' || tag === 'select' ? 'value' : 'innerText';

        const fn = `${variable}${i}@${scope}`;

        addScript(
            scripts,
            scope,
            `__${scope}__.addEventHandler('${fn}',$=>{
  $.${variable} = document.getElementById(\`${id}\`).${prop}
}, true);`
        );

        el.setAttribute('oninput', `window.nijor.bucket['${fn}']()`);
    });
}

/* ------------------------- Refs ------------------------- */

function handleRefs(document, scripts) {
    document.querySelectorAll('[n:ref]').forEach(el => {
        const id = ensureId(el);
        const variable = el.getAttribute('n:ref').trim().slice(3, -1);

        scripts.defer += `\n $.${variable} = document.getElementById(\`${id}\`);`;
        el.removeAttribute('n:ref');
    });
}

/* ------------------------- Main ------------------------- */

export function reactive({ document, scope, scripts }) {
    handleVars(document, scripts, scope);
    handleReactiveAttributes(document, scripts, scope);
    handleClasses(document, scripts, scope);
    handleBindings(document, scripts, scope);
    handleRefs(document, scripts);

    return {
        name: "Reactivity",
        data: {
            body: document.body.innerHTML,
            ...scripts
        }
    };
}