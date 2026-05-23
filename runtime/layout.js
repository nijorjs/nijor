import { state } from "./reactivity.js";

const range = document.createRange();

export default class{
    constructor(template,callback,scope) {
        this.template = template.bind(this);
        this.cb = callback.bind(this);
        this.scope = scope;
        this.state = state({});
    }
    async render(root = document.body){
        const template = await this.template();
        const fragment = range.createContextualFragment(template);
        root.replaceChildren(fragment);
        await this.cb();
    }
}