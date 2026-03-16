import { compressArray } from '../../utils/compress-array.js';

export function runComponents(element, scope) {
    let runFn = '';
    const regex = new RegExp(`\\w+_${scope}`);
    let components = [];
    [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase())).reverse().forEach(component => components.push(component.tagName.toLowerCase()));
    compressArray(components).forEach(([name, count]) => runFn += `await $${name.replaceAll('-','')}.run('${name}',${count});`);
    return runFn;
}

export function runComponentsCount(element, scope) {
    const regex = new RegExp(`\\w+_${scope}`);
    let components = [];

    [...element.querySelectorAll("*")].filter((el) => regex.test(el.tagName.toLowerCase())).reverse().forEach((component) => components.push(component.tagName.toLowerCase()));

    const compressed = compressArray(components);

    // return a function that takes count
    return function (count) {
        let runFn = "";
        compressed.forEach(([name]) => {
            runFn += `await $${name.replaceAll('-','')}.run('${name}',${count});`;
        });
        return runFn;
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