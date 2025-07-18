// This code is copied from @rollup/plugin-virtual
// I had to copy this code instead of using the plugin directly because I needed to tweak it a bit.

// 'use strict';

import path from 'path';

function _interopNamespaceDefault(e) {
    let n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                let d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

let path__namespace = _interopNamespaceDefault(path);

const PREFIX = ``;

export default modules => {
    const resolvedIds = new Map();
    Object.keys(modules).forEach((id) => {
        resolvedIds.set(path__namespace.resolve(id), modules[id]);
    });
    return {
        name: 'virtual',
        resolveId(id, importer) {
            if (id in modules)
                return PREFIX + id;
            if (importer) {
                const importerNoPrefix = importer.startsWith(PREFIX) ? importer.slice(PREFIX.length) : importer;
                const resolved = path__namespace.resolve(path__namespace.dirname(importerNoPrefix), id);
                if (resolvedIds.has(resolved)) return PREFIX + resolved;
            }
            return null;
        },
        load(id) {
            if (id.startsWith(PREFIX)) {
                const idNoPrefix = id.slice(PREFIX.length);
                return idNoPrefix in modules ? modules[idNoPrefix] : resolvedIds.get(idNoPrefix);
            }
            return null;
        }
    };
}