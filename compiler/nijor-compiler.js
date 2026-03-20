import createFilter from './helpers/createFilter.js';
import { JSDOM } from 'jsdom';
import GenerateID from '../utils/uniqeid.js';
import { replaceTags } from '../utils/replaceTags.js';
import { getRoute } from '../utils/getRoute.js';
import * as Scripts from './handleScripts.js';
import { compressArray } from '../utils/compress-array.js';
import { WriteStyleSheet } from './style.js';
import { minifyHTML } from '../utils/minify.js';
import { compileReactive } from './compileReactive.js';
import path from 'path';

// Plugins
import onEvent from './plugin/event.js';
import slot from './plugin/slot.js';
import { loop } from './plugin/loop.js';
import { reactive } from './plugin/reactivity.js';

export default options => {

    let opts = { include: '**/*.nijor' };
    const filter = createFilter(opts.include, opts.exclude);
    return {

        name: "compiler",
        async transform(code, filename) {

            const { plugins: nijor_plugins } = await import(path.join(options.root, 'nijor.config.js'));

            if (filter(filename)) {

                code = replaceTags(code, 'body', 'nijor-body');
                code = replaceTags(code, 'head', 'nijor-head');
                code = replaceTags(code, 'style', 'nijor-style');

                const virtual_doc = new JSDOM(code);
                const document = virtual_doc.window.document;
                const scope = GenerateID(4, 6).toLowerCase();

                // Add theme to style
                document.querySelectorAll('nijor-style').forEach(child => {
                    if (!(child.hasAttribute('theme'))) child.setAttribute('theme', 'normal');
                });

                // Transform {var} to ${var} inside body
                document.querySelector('nijor-body').querySelectorAll('*').forEach(element => {
                    element.childNodes.forEach(node => {
                        if (node.nodeType === 3 && node.textContent.trim()) {
                            processTextNode(node, element);
                        }
                    });

                    processAttributes(element);
                });

                // Transform {var} to ${var} inside head
                document.getElementsByTagName('nijor-head')[0]?.querySelectorAll('*').forEach(child => {

                    if (child.tagName.toLowerCase() == "title") {
                        child.textContent = child.textContent.replace(/`/g, '\\`').replace(/{/g, '${').replace(/\\\${/g, '\{')
                        return;
                    }

                    child.childNodes.forEach(node => {
                        if (node.nodeType === 3 && node.textContent.trim()) {
                            node.textContent = node.textContent.replace(/(?<!\\){/g, '[').replace(/(?<!\\)}/g, ']');
                        }
                    });

                    for (let attr of child.attributes) {
                        let { name, value } = attr;
                        name = name.toLowerCase();
                        child.setAttribute(name, value.replace(/(?<!\\){/g, '[').replace(/(?<!\\)}/g, ']'));
                    }

                });

                // Hanlde class:classname
                document.querySelectorAll("*").forEach(element => {
                    const ReactiveClasses = [];

                    Array.from(element.attributes).forEach(attr => {
                        if (attr.name.startsWith('class:')) {
                            const className = attr.name.split(':')[1];
                            const value = attr.value;
                            const condition = (value.startsWith("{") && value.endsWith("}")) ? value.slice(1,-1) : value;
                            let clsStr = (element.getAttribute("class") ?? "") + ` \${${condition} ? '${className}' : ''}`;
                            element.setAttribute('class', clsStr);
                            element.removeAttribute(attr.name);

                            const exprMatches = [...value.matchAll(/\{([^}]+)\}/g)];
                            let collectedVars = new Set();

                            for (const match of exprMatches) {
                                const expr = match[1];
                                const vars = extractReactiveVars(expr);
                                vars.forEach(v => collectedVars.add(v));
                            }

                            // If no reactive variables
                            if(collectedVars.size==0) return;

                            // For reactive variables
                            const reactiveClassName = `n:rclass:${className}`;
                            const existing = element.getAttribute(reactiveClassName);
                            const merged = new Set(existing ? existing.split(' ') : []);
                            collectedVars.forEach(v => merged.add(v));
                            element.setAttribute(reactiveClassName, [...merged].join(' '));
                            element.setAttribute(`${reactiveClassName}:condition`, condition);
                            ReactiveClasses.push(className);
                        }
                    });

                    if(ReactiveClasses.length > 0){
                        element.setAttribute('n:rclasses',ReactiveClasses.join(' '));
                    }

                });

                // Write style sheets
                await WriteStyleSheet(document, scope, options);

                const [$import, $script] = Scripts.sanitize(virtual_doc);
                const $components = Scripts.ReturnModule(virtual_doc, scope);
                const scripts = {
                    import: new Set($import),
                    components: $components,
                    global: "",
                    main: compileReactive($script),
                    defer: virtual_doc.window.document.querySelector('script[defer]').innerHTML
                };

                const plugins = [onEvent, slot, loop, reactive, ...(nijor_plugins ?? [])];

                return {
                    code: await transformCode(virtual_doc, scope, scripts, mod_type(filename), plugins, filename),
                    map: { mappings: "" }
                };
            }
        }
    };
}

async function transformCode(virtual_doc, scope, scripts, module_type, plugins, filename) {
    const v_document = virtual_doc.window.document;
    const vbody = v_document.querySelector('nijor-body');
    const props = vbody.getAttribute('params') || vbody.getAttribute('props') || '{}';

    // Rename components from <component> to <component_scope>
    v_document.querySelectorAll("import").forEach(child => {
        if(child.closest('nijor-body')) return;
        const componentName = child.getAttribute('name').toLowerCase();
        vbody.innerHTML = replaceTags(vbody.innerHTML, componentName, componentName + '_' + scope);
    });

    const vdoc = new JSDOM(vbody.innerHTML);
    const document = vdoc.window.document;

    // Add n-scope attribute to html tags
    document.body.querySelectorAll('*').forEach((child) => {
        // Not adding n-scope to components, code and pre
        if (child.closest('code') || child.closest('pre') || child.hasAttribute('n-scope') || child.tagName.toLowerCase().split('_')[1] === scope) return;
        child.setAttribute('n-scope', scope);
    });

    // Add _id attribute to components
    document.body.querySelectorAll('*').forEach((child) => {
        const [component_name, component_scope] = child.tagName.toLowerCase().split('_');
        if (component_scope === scope) {
            child.setAttribute('_id', component_name + GenerateID(5, 7).toLowerCase());
        }
    });

    // Transform n:route
    document.body.querySelectorAll('a[n:route]').forEach(child => {
        let route = child.getAttribute('n:route');
        child.removeAttribute('n:route');
        child.setAttribute('onclick', `return window.nijor.redirect(this.href)`);
        child.setAttribute('href', route);
    });

    for await (const plugin of plugins) {
        const {name, data } = await plugin({ document, scope, props, scripts, filename, module_type });
        try {
            document.body.innerHTML = data.body;
            scripts.import = data.import;
            scripts.global = data.global;
            scripts.main = data.main;
            scripts.defer = data.defer;
        } catch (error) {
            console.error(`Plugin[${name}] : ${error}`);
        }
    }

    // Running all the visible components
    const regex = new RegExp(`\\w+_${scope}`);
    const allComponents = [...document.body.querySelectorAll('*')]
        .filter(el => regex.test(el.tagName.toLowerCase()) && !el.closest('[n:loop]'))
        .map(el => el.tagName.toLowerCase())
        .reverse();

    document.body.querySelectorAll("[n:loop]").forEach(l => l.removeAttribute('n:loop'));

    const calls = compressArray(allComponents).map(([name, count]) => {
        return `$${name.replaceAll('-','')}.run('${name}',${count})`;
    });

    if (calls.length) {
        scripts.defer = `await Promise.all([${calls.join(',')}]);\n` + scripts.defer;
    }

    const imports = [...scripts.import].join('\n');

    const template = minifyHTML(document.body.innerHTML);

    if (module_type == "page") {
        const layout = vbody.getAttribute('layout') || 'default';
        const head = v_document.getElementsByTagName('nijor-head')[0];
        const title = head?.querySelector('title').textContent;

        if (head) {
            if (head.querySelector('title')) head.removeChild(head.querySelector('title'));
            let metadata = minifyHTML(head.innerHTML);
            if (metadata != "") process.metadataMap.set(getRoute(filename), metadata);
        }

        process.layoutMap.set(getRoute(filename), layout);

        return `
            import page_${process.seed} from 'nijor/page';
            ${imports}
            ${scripts.components}

            const $id = "__${scope}";
            
            const __${scope}__ = new page_${process.seed}(async function(${props},$){
                document.title = \`${title}\`;
                ${scripts.main}
                return(\`${template}\`);
            },async function(${props},$){
                ${scripts.defer}
            },'${layout}');

            ${scripts.global}

            export default __${scope}__;
        `;
    }

    if (module_type == "layout") {
        return `
            import layout_${process.seed} from 'nijor/layout';
            ${imports}
            ${scripts.components}

            const $id = "__${scope}";

            const __${scope}__ = new layout_${process.seed}(async function(){
                ${scripts.main}
                return(\`${template}\`);
            },async function(){
                ${scripts.defer}
            });

            ${scripts.global}

            export default __${scope}__;
        `;
    }

    return `
        import component_${process.seed} from 'nijor/component';
        ${imports}
        ${scripts.components}
        
        const __${scope}__ = new component_${process.seed}(async function(${props},$id,$){
            ${scripts.main}
            return(\`${template}\`);
        },async function(${props},$id,$){
            ${scripts.defer}
        });

        ${scripts.global}

        export default __${scope}__;
    `;
}

function mod_type(filename) {
    const RootPath = process.cwd();
    const srcPath = path.join(RootPath, 'src');
    filename = filename.replace(srcPath, '');
    if (filename.startsWith('/pages/')) return 'page';
    if (filename.startsWith('/layouts/')) return 'layout';
    return 'component';
}

function extractReactiveVars(expression) {
    const vars = new Set();
    const regex = /\$\.(\w+)/g;

    let match;
    while ((match = regex.exec(expression)) !== null) {
        vars.add(match[1]);
    }

    return [...vars];
}

function transformCurlyExpressions(text) {
    let result = '';
    let i = 0;

    while (i < text.length) {
        // Check if the current '{' is escaped by a '\'
        if (text[i] === '\\' && text[i + 1] === '{') {
            result += '{'; // Add the brace without the backslash
            i += 2;        // Skip both the '\' and the '{'
            continue;
        }

        if (text[i] === '{') {
            let depth = 1;
            let j = i + 1;

            while (j < text.length && depth > 0) {
                if (text[j] === '{') depth++;
                else if (text[j] === '}') depth--;
                j++;
            }

            if (depth === 0) {
                const expr = text.slice(i + 1, j - 1);
                result += '${' + expr + '}';
                i = j;
                continue;
            }
        }

        result += text[i];
        i++;
    }

    return result;
}

function processAttributes(element) {
    for (let attr of [...element.attributes]) {
        let attrName = attr.name;
        const value = attr.value;

        if (attrName == "n:route") {
            element.setAttribute(attrName, transformCurlyExpressions(value));
            attrName = "href";
        }

        if (attrName.includes("n:") || attrName.includes("class:")) continue; // Don't process n:bind or n:ref

        if (!value.includes('{')) continue;

        const exprMatches = [...value.matchAll(/\{([^}]+)\}/g)];

        let collectedVars = new Set();

        for (const match of exprMatches) {
            const expr = match[1];
            const vars = extractReactiveVars(expr);
            vars.forEach(v => collectedVars.add(v));
        }

        if (collectedVars.size > 0) {

            const nAttrName = `n:attr:${attrName}`;
            const existing = element.getAttribute(nAttrName);
            const merged = new Set(existing ? existing.split(' ') : []);

            collectedVars.forEach(v => merged.add(v));

            // if (attrName.startsWith('class:')) {
            //     element.setAttribute(`${attrName.replace(':', '-')}`, [...merged].join(' '));
            //     continue;
            // }
            element.setAttribute(nAttrName, [...merged].join(' '));
        }

        element.setAttribute(attrName, transformCurlyExpressions(value));
    }
}

function processTextNode(node, parentElement) {
    const original = node.textContent;

    if (!original.includes('{')) return;

    // const exprMatches = [...original.matchAll(/\{([^}]+)\}/g)];
    const exprMatches = [...original.matchAll(/(?<!\\)\{([^}]+)\}/g)];

    let collectedVars = new Set();

    for (const match of exprMatches) {
        const expr = match[1];
        const vars = extractReactiveVars(expr);
        vars.forEach(v => collectedVars.add(v));
    }

    if (collectedVars.size > 0) {
        const existing = parentElement.getAttribute('n:var');
        const merged = new Set(existing ? existing.split(' ') : []);

        collectedVars.forEach(v => merged.add(v));

        parentElement.setAttribute('n:var', [...merged].join(' '));
    }

    node.textContent = transformCurlyExpressions(original);
}