import component from './components.js';
import reactiveVars from './reactivity.js';
// window.nijor is an object used by Nijor during runtime.
// window.nijorfunc is an object that stores all the events like on:click="clicked()" (on:{event}="func()") 
window.nijor = { component };
window.eventStorage = {};
window.reactiveVar = reactiveVars;

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
};

export const reload = reloadId => window.eventStorage[reloadId+"@reload"]();