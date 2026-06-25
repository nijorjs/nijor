import { state, cleanCacheCommentNodes } from "./reactivity.js";

const range = document.createRange();

export let cleanupFunctions = new Set();
export const Cleanup = () => {
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions.clear();
    cleanCacheCommentNodes();
}

export default class {
    constructor(template, layout) {
        this.template = template;
        this.cb = null;
        this.layout = layout;
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

    attachEventHandlers($) {
        for (const [key, handler, reactive, isAwait] of this.eventHandlers) {
            if (!window.nijor.bucket[key]) {
                if (reactive) {
                    if(isAwait) window.nijor.bucket[key] = async (...args) => await handler(...args, $);
                    else window.nijor.bucket[key] = (...args) => handler(...args, $);
                }
                else window.nijor.bucket[key] = handler;
                cleanupFunctions.add(() => delete window.nijor.bucket[key]);
            }
        }
    }

    subscribe(variable,handler){
        this.subscriptions.add([variable,handler]);
    }

    activateReactiveStates($){
        for (const [variable,handler] of this.subscriptions){
            const unsubscribe = $.$subscribe(variable,handler);
            cleanupFunctions.add(unsubscribe);
        }
        this.subscriptions.clear();
    }

    async render(root, params) {
        const $ = state({});
        const slot = document.getElementById(root) || window.nijor.root;
        const template = await this.template(params, $);
        if (!template) return;
        const fragment = range.createContextualFragment(template);
        slot.replaceChildren(fragment);

        for (const element of this.dependencies) {
            await element[0].run(element[1], element[2]);
        }

        this.attachEventHandlers($);
        this.activateReactiveStates($);
        if (this.cb) await this.cb(params, $);
    }

    hydrate() {
        const $ = state({});
        for (const element of this.dependencies) {
            element[0].hydrate("page");
        }
        this.attachEventHandlers("page", $);
        this.activateReactiveStates($);
    }
}