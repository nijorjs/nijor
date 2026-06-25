import { state } from "./reactivity.js";
import { cleanupFunctions as cleanupFunctionsLayout } from "./layout.js";
import { cleanupFunctions as cleanupFunctionsPage } from "./page.js";

function getAttributes(el) {
    let nodes = [], values = [];
    for (let att, i = 0, atts = el.attributes, n = atts.length; i < n; i++) {
        att = atts[i];
        nodes.push(att.nodeName);
        values.push(att.nodeValue);
    }
    nodes.push('html');
    values.push(el.innerHTML);
    let keys = nodes;
    let Values = values;
    let allAttributes = {};
    keys.forEach((key, i) => allAttributes[key] = Values[i]);
    return allAttributes;
}

const range = document.createRange();

export default class {
    constructor(template) {
        this.template = template;
        this.cb = null;
        this.dependencies = new Set();
        this.eventHandlers = new Set();
        this.subscriptions = new Set();
    }

    addDependency(component, name, count) {
        this.dependencies.add([component, name, count]);
    }

    addEventHandler(key, handler, reactive = false, isAwait = false) {
        this.eventHandlers.add([key, handler, reactive, isAwait]);
    }

    attachEventHandlers(parent_type, $) {
        for (const [key, handler, reactive, isAwait] of this.eventHandlers) {
            if (!window.nijor.bucket[key]) {
                if (reactive) {
                    if (isAwait) window.nijor.bucket[key] = async (...args) => await handler(...args, $);
                    else window.nijor.bucket[key] = (...args) => handler(...args, $);
                }
                else window.nijor.bucket[key] = handler;
                if (parent_type === "layout") cleanupFunctionsLayout.add(() => delete window.nijor.bucket[key]);
                if (parent_type === "page") cleanupFunctionsPage.add(() => delete window.nijor.bucket[key]);
            }
        }
    }

    subscribe(variable, handler) {
        this.subscriptions.add([variable, handler]);
    }

    unsub(){
        this.subscriptions.clear();
    }

    activateReactiveStates(parent_type, $) {
        for (const [variable, handler] of this.subscriptions) {
            const unsubscribe = $.$subscribe(variable, handler);
            if (parent_type === "layout") cleanupFunctionsLayout.add(unsubscribe);
            if (parent_type === "page") cleanupFunctionsPage.add(unsubscribe);
        }
        this.subscriptions.clear();
    }

    async run(name) {
        const elements = Array.from(document.getElementsByTagName(name));

        await Promise.all(elements.map(async (component) => {
            const $ = state({});
            const props = getAttributes(component);
            if (!props.id) props._id = Math.random().toString(36).substr(2, 9);
            if (!props._parent) props._parent = "body";
            const template = await this.template(props, props._id, props._parent, $);
            if (!template) return;

            const fragment = range.createContextualFragment(template);
            component.replaceWith(fragment);

            for (const element of this.dependencies) {
                await element[0].run(element[1], element[2]);
            }

            this.attachEventHandlers(props._parent, $);
            this.activateReactiveStates(props._parent,$);
            if (this.cb) await this.cb(props, props._id, $);
        }));
    }

    hydrate(_parent) {
        const $ = state({});
        for (const element of this.dependencies) {
            element[0].hydrate(_parent);
        }
        this.attachEventHandlers(_parent, $);
        this.activateReactiveStates(_parent, $);
    }

}