export function reactive(initialValue,varname,scope) {

    const handlers = {
        get(target, property) {
            return target[property];
        },
        set(target, property, value) {
            target[property] = value; 
            listeners.forEach(listener => listener(reactiveObj.value));
            notifyListeners(value,varname,scope);
            return true;
        }
    };

    const reactiveObj = new Proxy({ value: initialValue }, handlers);
    const listeners = new Set();

    return {
        get value() {
            return reactiveObj.value;
        },
        set value(newValue) {
            reactiveObj.value = newValue;
        },
        init(){
            notifyListeners(reactiveObj.value,varname,scope);
        },
        subscribe(listener) {
            listeners.add(listener);
            // listener(reactiveObj.value); // Call listener with initial value
            return () => listeners.delete(listener); // Unsubscribe
        }
    };
}

function notifyListeners(value,varname,scope){
    document.querySelectorAll(`._${varname}_${scope}`).forEach(element=>{
        element.innerHTML = replaceVariable(element.innerHTML,`${varname}@${scope}`, value);
    });
}

function replaceVariable(str, varName, value) {
  const regex = new RegExp(`(<!--${varName}-->)(.*?)(<!--/-->)`, 'g');
  return str.replace(regex, `$1${value}$3`);
}