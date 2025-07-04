// window.nijor is an object used by Nijor during runtime.
// window.eventStorage is an object that stores all the events like on:click="clicked()" (on:{event}="func()") 
window.nijor = { };
window.eventStorage = { };

function modifyParenthesisContent(input,_this,$data) {
    return input.replace(/\((.*?)\)/g, (match, content) => {
        let modifiedContent = content.split(',').map(word => {
            let trimmedWord = word.trim();
            if (trimmedWord === 'this') return _this;
            if (trimmedWord === '$data') return $data;
            return trimmedWord;
        }).join(', ');
        return `(${modifiedContent})`;
    });
}

export function dispatchEvent(eventName, data = {}) {
    document.querySelectorAll(`[on${eventName}]`).forEach(element=>{
        let fnExpression = modifyParenthesisContent(element.getAttribute(`on${eventName}`),'_this','$data');
        let EvalFunc = new Function('_this','$data', `${fnExpression}`);
        EvalFunc(element,data);
    });
}

export const reload = reloadId => window.eventStorage[reloadId+"@reload"]();

function RenderScript(){
    if(document.body.hasAttribute('nijor-build')) return;
    const hydrationTemplate = document.head.querySelector("script[type='hydration']");
    if(!hydrationTemplate) return;
    const script = document.createElement('script');
    script.setAttribute('type','module');
    script.innerHTML = hydrationTemplate.innerHTML;
    document.head.appendChild(script);
    document.head.removeChild(hydrationTemplate);
}

export async function Render(App,app='app'){
    if(!window.nijor.renderRoute){ 
        // If Router is not used.
        App.init(app);
        await App.run();
        return;
    }
    if(document.body.getElementsByTagName(app).length===0){
        RenderScript();
        return;
    }
    App.init(app);
    await App.run();
    await window.nijor.renderRoute(window.location.pathname);
}