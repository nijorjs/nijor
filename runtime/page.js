export default class{
    constructor(template,callback) {
        this.template = template;
        this.cb = callback;
    }
    async render(root,params){
        const content = await this.template(params);
        let slot = document.getElementById(root);
        if(!slot) slot = document.body;
        slot.innerHTML = content;
        await this.cb(params);
    }
}