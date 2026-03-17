import { state } from "./reactivity.js";

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
    constructor(template, callback) {
        this.template = template;
        this.cb = callback;
    }

    async run(name, num = 1) {
        const elements = Array.from(document.getElementsByTagName(name)).slice(0, num);

        await Promise.all(elements.map(async (component) => {
            const $ = state({});
            const props = getAttributes(component);

            const template = await this.template(props, props._id, $);
            if (!template) return;

            const fragment = range.createContextualFragment(template);
            component.replaceWith(fragment);

            await this.cb(props, props._id, $);
        }));
    }
}