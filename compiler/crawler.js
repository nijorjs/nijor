import fs from 'fs/promises';
import path from 'path';

let Code = "";
export let Files = new Set();
let Slots = new Set();
Slots.add('/');

export async function crawlDirectory(directory,  type, inplace=true) {
    const directoryPath = inplace ? path.join(directory, type + 's') : directory;
    const files = await fs.readdir(directoryPath);
    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile() && path.basename(filePath) != ".nijor") Files.add({path: filePath, type});
        else if (stats.isDirectory()) await crawlDirectory(filePath, type, false);
    }
}

function AddRoute(filepath) {
    let url = getRoute(filepath);
    let { params, pattern } = getRouteMapKey(url);
    Code += `window.nijor.setRoute({ pattern: ${pattern}, params : ${JSON.stringify(params)} },()=>import('${filepath.replace(/\\/g, '/')}'));\n`;
}

function AddLayout(filepath) {
    let name = path.basename(filepath).slice(0,-6);
    Code += `window.nijor.addLayout('${name}',()=>import('${filepath.replace(/\\/g, '/')}'));\n`;
}

export const crawl = async directory => {
    Code = "";
    Files.clear();

    await crawlDirectory(directory, 'layout');
    await crawlDirectory(directory, 'page');

    Files.forEach(({path, type})=> {
        if(type=="layout") AddLayout(path);
        if(type=="page") AddRoute(path);
    });

    let App = await fs.readFile(path.join(directory, 'App.js'), 'utf-8');
    App = App.replace('//@Routes()', Code);

    return App;
}

function getRoute(filepath) {
    filepath = filepath.replace(/\\/g, '/');
    let route = '/' + filepath.split('src/pages/')[1].replace('.nijor', '');
    if (route.endsWith('/') && route != "/") route = route.substring(0, route.length - 1);
    const fragments = route.split('/');
    const lastFragment = fragments[fragments.length - 1];
    let url = '';

    if (fragments.length > 1 && lastFragment === "index") fragments.pop();
    url = fragments.join('/') || '/';

    return url;
}

function getRouteMapKey(path) {
    // Convert path pattern to regex and store parameter names
    const params = [];
    const regexPath = path.replace(/\[(.*?)\]/g, (_, name) => { params.push(name); return '([^/]+)'; }).replace(/\//g, '\\/');

    return {
        pattern: new RegExp(`^${regexPath}$`),
        params
    };
}