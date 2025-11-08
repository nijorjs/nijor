function getAttributes(el) {
    let nodes = [], values = [];
    for (let att, i = 0, atts = el.attributes, n = atts.length; i < n; i++) {
        att = atts[i];
        nodes.push(att.nodeName);
        values.push(att.nodeValue);
    }
    nodes.push('_text_');
    values.push(el.innerHTML);
    let keys = nodes;
    let Values = values;
    let allAttributes = {};
    keys.forEach((key, i) => allAttributes[key] = Values[i]);
    return allAttributes;
}

export default class{
    constructor(template,callback) {
        this.template = template;
        this.cb = callback;
    }

    async run(name,num=1){
        const tag_name = new RegExp(`(<${name}[^>]+>|<${name}>)`);
        let index = 0;
        while (index < num) {
            const component = document.getElementsByTagName(name)[0];
            if (!component) break;
            const props = getAttributes(component);
            component.innerHTML = "";
            const parentElement = component.parentElement ? component.parentElement : document.body;
            const content = await this.template(props);
            parentElement.innerHTML = parentElement.innerHTML.replace(tag_name,content);
            this.cb(props).then(()=>index++).catch(()=>index++);
        }
    }
}