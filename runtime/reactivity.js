// Get elements enclosed within <!--id-->...<!--/id-->
let cache = new Map();
export function getNodesByCommentID(commentID, rootNode) {
    let regionStart = null;
    let regionEnd = null;

    if (cache.has(commentID)) {
        [regionStart, regionEnd] = cache.get(commentID);
    }

    if(!regionStart || !regionEnd){
        const iterator = document.createTreeWalker(rootNode, NodeFilter.SHOW_COMMENT);

        while (iterator.nextNode()) {
            const node = iterator.currentNode;
            const text = node.textContent.trim();
            if (text === `${commentID}`) regionStart = node;
            if (text === `/${commentID}`) regionEnd = node;

            if (regionStart && regionEnd) break;
        }

        // Move the check HERE
        if (!regionStart || !regionEnd) {
            console.error(`Could not find markers for ${commentID}`);
            return null;
        }

        cache.set(commentID, [regionStart, regionEnd]);
    }

    const nodes = [];
    let current = regionStart; // 1. Start AT the marker, not after it
    while (current) {
        nodes.push(current);
        if (current === regionEnd) break; // 2. Stop AFTER pushing the end marker
        current = current.nextSibling;
    }

    return nodes;
}

// State used by components layouts pages
export function state(data) {
    const subscribers = new Map();

    function subscribe(prop, fn) {
        if (!subscribers.has(prop)) subscribers.set(prop, new Set());
        subscribers.get(prop).add(fn);
        return () => subscribers.get(prop).delete(fn);
    }

    function unsubscribeAll(prop) {
        subscribers.delete(prop);
    }

    function reset() {
        subscribers.clear();
        for (const key in data) delete data[key];
    }

    function notify(topKey, next, prev) {
        subscribers.get(topKey)?.forEach(fn => {
            try {
                fn(next, prev);
            } catch (e) {
                console.error(`[state] subscriber error on "${topKey}":`, e);
            }
        });
    }

    function makeNestedProxy(obj, topKey) {
        if (typeof obj !== 'object' || obj === null) return obj;

        return new Proxy(obj, {
            get(target, key) {
                if (typeof key === 'symbol') return target[key];
                return makeNestedProxy(target[key], topKey);
            },
            set(target, key, value) {
                if (target[key] === value) return true;
                const oldValue = structuredClone(target[key]);
                target[key] = value;
                notify(topKey, data[topKey], oldValue);
                return true;
            }
        });
    }

    return new Proxy(data, {
        get(target, key) {
            if (key === '$subscribe') return subscribe;
            if (key === '$unsubscribeAll') return unsubscribeAll;
            if (key === '$reset') return reset;
            if (typeof key === 'symbol') return target[key];
            return makeNestedProxy(target[key], key);
        },
        set(target, key, value) {
            if (target[key] === value) return true;
            const oldValue = target[key];
            target[key] = value;
            notify(key, value, oldValue);
            return true;
        }
    });
}

// Helper function for list
function assertIds(items, context) {
    const missing = items.filter(obj => !obj._id);
    if (missing.length > 0) {
        throw new Error(`[reactiveData] ${context}: ${missing.length} object(s) missing _id`);
    }
}
// Efficient List used in loop and load
export function list(arr) {
    assertIds(arr, 'initialization');
    let internal = [...arr];

    const subscribers = new Set();

    function notify(change) {
        subscribers.forEach(fn => {
            try {
                fn(change);
            } catch (e) {
                console.error('[reactiveData] subscriber error:', e);
            }
        });
    }

    return {
        get value() {
            return internal;
        },

        subscribe(fn) {
            subscribers.add(fn);
            return () => subscribers.delete(fn);
        },

        insert(elements) {
            const items = Array.isArray(elements) ? elements : [elements];
            assertIds(items, 'insert');
            internal.push(...items);
            notify({ operation: 'insert', elements: items });
        },

        delete(ids) {
            const targets = Array.isArray(ids) ? ids : [ids];
            internal = internal.filter(obj => !targets.includes(obj._id));
            notify({ operation: 'delete', elements: targets });
        },

        update(id, newObj) {
            const index = internal.findIndex(obj => obj._id === id);
            if (index === -1) return;
            internal[index] = { ...newObj, _id: id };
            notify({ operation: 'update', value: internal[index] });
        },

        rewrite(elements) {
            const items = Array.isArray(elements) ? elements : [elements];
            assertIds(items, 'insert');
            internal = items;
            notify({ operation: 'rewrite', value: internal });
        }
    };
}

// Shared Reactive Variables
export function reactive(value) {
    const listeners = new Set();
    let currentValue = value;

    function notifyListeners() {
        for (const listener of listeners) {
            try {
                listener(currentValue);
            } catch (e) {
                console.error('[reactive] listener threw an error:', e);
            }
        }
    }

    return {
        get value() {
            return currentValue;
        },
        set value(newValue) {
            if (currentValue === newValue) return;
            currentValue = newValue;
            notifyListeners();
        },
        subscribe(listener) {
            if (typeof listener !== 'function') {
                throw new TypeError(`subscriber must be a function, got ${typeof listener}`);
            }
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

// Reload components with reactive variables
export async function reload(id,component,name,str) {
    const nodes = getNodesByCommentID(id,document.body);
    const range_ = document.createRange();
    const fragment = range_.createContextualFragment(str);
    range_.setStartBefore(nodes[1]);
    range_.setEndAfter(nodes[nodes.length - 2]);
    range_.deleteContents();
    range_.insertNode(fragment);
    await component.run(name,1);   
}