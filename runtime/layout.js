import { state } from "./reactivity.js";

const range = document.createRange();

export default class{
    constructor(template,callback) {
        this.template = template.bind(this);
        this.cb = callback.bind(this);
        this.state = state({});
    }
    async render(root = document.body){
        const template = await this.template();
        const fragment = range.createContextualFragment(template);
        root.replaceChildren(fragment);
        await this.cb();
    }
}