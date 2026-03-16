import { state } from "./reactivity.js";

const range = document.createRange();

export default class{
    constructor(template,callback,layout) {
        this.template = template;
        this.cb = callback;
        this.layout = layout;
    }
    async render(root,params){
        const $ = state({});
        const slot = document.getElementById(root) || window.nijor.root;
        const template = await this.template(params, $);
        if(!template) return;
        const fragment = range.createContextualFragment(template);
        slot.replaceChildren(fragment);
        await this.cb(params, $);
    }
}
