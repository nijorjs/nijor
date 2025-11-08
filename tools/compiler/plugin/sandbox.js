import { compressArray } from '../../../utils/compress-array.js';

export function runComponents(element, scope) {
    let runFn = '';
    const regex = new RegExp(`\\w+_${scope}`);
    let components = [];
    [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase())).reverse().forEach(component => components.push(component.tagName.toLowerCase()) );
    compressArray(components).forEach(([name,count])=> runFn += `await $${name}.run('${name}',${count});` );
    return runFn;
}