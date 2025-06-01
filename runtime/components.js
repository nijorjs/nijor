function getAttributes(el) {
    /*
    This function returns the key-value-pair of an HTML element.
    Example: 
        HTML: <card name="Test" price="Test"></card>
        JS: document.getElementsByName('card')[0].getAttributes; will return {name:'Test',price:'Test'}
    */
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
    return (allAttributes);
};
export default class{
    constructor(template,callback) {
        this.template = template;
        this.cb = callback;
    }
    init(name){
        this.name = name;
    }
    run = async function(urlParameters){
        let to_be_replaced = new RegExp(`(<${this.name}[^>]+>|<${this.name}>)`);
        let element = document.getElementsByTagName(this.name)[0];
        if(document.getElementsByTagName(this.name).length===0) return;
        let allSpecs = getAttributes(element);
        if(urlParameters!=null) allSpecs = urlParameters;
        try { element.innerHTML=""; } catch (error) {} 
        try {
            let result = await this.template(allSpecs);
            element.parentElement.innerHTML = element.parentElement.innerHTML.replace(to_be_replaced,result);
            await this.cb(allSpecs);
            await this.run();
        } catch (error) {
            let result = await this.template(allSpecs);
            document.body.innerHTML = document.body.innerHTML.replace(to_be_replaced,result);
            await this.cb(allSpecs);
            await this.run();
        }
    }
}