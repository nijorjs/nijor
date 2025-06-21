export function reactive(initialValue) {
    const handlers = {
        get(target, property) {
            return target[property];
        },
        set(target, property, value) {
            target[property] = value;
            notifyListeners(listeners,value);
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
            if(reactiveObj.value == newValue) return;
            reactiveObj.value = newValue;
        },
        init(){
            reactiveObj.value = initialValue;
            // notifyListeners(listeners,reactiveObj.value);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener); // Unsubscribe
        }
    }
}

function notifyListeners(listeners,value) {
    listeners.forEach(listener => { try { listener(value) } catch (e) {} });
}

export function replaceTemplate(str, data) {
  return str.replace(/(?<!\\)\{@(\w+)\}/g, (_, key) => {
    return key in data ? data[key] : '';
  }).replace(/\\\{@(\w+)\}/g, '{@$1}'); // remove the backslash for escaped ones
}