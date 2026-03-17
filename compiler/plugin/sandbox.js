import { compressArray } from '../../utils/compress-array.js';

export function runComponents(element, scope) {
    const regex = new RegExp(`\\w+_${scope}`);
    let components = [];

    [...element.querySelectorAll('*')]
        .filter(el => regex.test(el.tagName.toLowerCase()))
        .reverse()
        .forEach(component => components.push(component.tagName.toLowerCase()));

    const calls = compressArray(components).map(([name, count]) => {
        return `$${name.replaceAll('-','')}.run('${name}',${count})`;
    });

    if (!calls.length) return '';

    return `await Promise.all([${calls.join(',')}]);`;
}

export function runComponentsCount(element, scope) {
    const regex = new RegExp(`\\w+_${scope}`);
    let components = [];

    [...element.querySelectorAll("*")]
        .filter(el => regex.test(el.tagName.toLowerCase()))
        .reverse()
        .forEach(component => components.push(component.tagName.toLowerCase()));

    const compressed = compressArray(components);

    return function (count) {
        const calls = compressed.map(([name]) => {
            return `$${name.replaceAll('-','')}.run('${name}',${count})`;
        });

        if (!calls.length) return '';

        return `await Promise.all([${calls.join(',')}]);`;
    };
}

export function getComponents(element, scope) {
    const regex = new RegExp(`\\w+_${scope}`);
    let components = [];
    [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase())).reverse().forEach(component => {
        let name = component.tagName.toLowerCase();
        if (components.includes(name)) return;
        components.push(name);
    });

    return components;
}

export function getAllComponents(element, scope){
    const regex = new RegExp(`\\w+_${scope}`);
    return [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase())).reverse();
}