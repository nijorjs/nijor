function createReactive(data) {
    const subscribers = new Map();

    function subscribe(prop, fn) {
        if (!subscribers.has(prop)) subscribers.set(prop, new Set());
        subscribers.get(prop).add(fn);
        return () => subscribers.get(prop).delete(fn);
    }

    function makeNestedProxy(obj, topKey) {
        if (typeof obj !== 'object' || obj === null) return obj;

        return new Proxy(obj, {
            get(target, key) {
                return makeNestedProxy(target[key], topKey); // recurse, always carry topKey
            },
            set(target, key, value) {
                target[key] = value;
                subscribers.get(topKey)?.forEach(fn => fn(data[topKey], data[topKey]));
                return true;
            }
        });
    }

    return new Proxy(data, {
        get(target, key) {
            if (key === '$subscribe') return subscribe;
            return makeNestedProxy(target[key], key); // wrap with topKey
        },
        set(target, key, value) {
            const oldValue = target[key];
            target[key] = value;
            subscribers.get(key)?.forEach(fn => fn(value, oldValue));
            return true;
        }
    });
}

const $state = createReactive({
    count: 0
});

$state.$subscribe('count', (next, prev) => {
    console.log(`Count : ${prev} → ${next}`);
});

$state.$subscribe('version', (next, prev) => {
    console.log(`Version : ${prev} → ${next}`);
});