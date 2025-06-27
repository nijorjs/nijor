import fs from 'fs/promises';
import path from 'path';

let Code = "";
export let Files = new Set();
let Slots = new Set();
Slots.add('/');

export async function crawlDirectory(directoryPath) {
  const files = await fs.readdir(directoryPath);
  for (const file of files) {
    const filePath = path.join(directoryPath, file);

    const stats = await fs.stat(filePath);
    if (stats.isFile() && path.basename(filePath)!=".nijor") Files.add(filePath);
    if (stats.isFile() && path.basename(filePath)=="_.nijor") AddSlot(filePath);
    else if (stats.isDirectory()) await crawlDirectory(filePath);
  }
}

function AddRoute(filepath){
    let { url,parentURL } = getRoute(filepath);
    let { params, pattern } = getRouteMapKey(url);
    Code += `window.nijor.setRoute({pattern: ${pattern}, params : ${JSON.stringify(params)} },()=>import('${filepath.replace(/\\/g,'/')}'),'${parentURL}');\n`;
}

async function AddSlot(filepath){
    const url = getRoute(filepath).url.slice(0,-2);
    Slots.add(url);
    Code += `window.nijor.addSlot('${url}',()=>import('${filepath.replace(/\\/g,'/')}'));`;
}

export const crawl = async directory =>{

    await crawlDirectory(path.join(directory,'pages'));
    Files.forEach(file=>{
        if(getRoute(file).url.endsWith("/_")) return;
        AddRoute(file);
    });

    global.Slots = Slots;

    let App = await fs.readFile(path.join(directory,'App.js'),'utf-8');
    App = App.replace('//@Routes()',Code);

    return App;
}

function getRoute(filepath){
    filepath = filepath.replace(/\\/g,'/');
    let route = '/'+filepath.split('src/pages/')[1].replace('.nijor','');
    if(route.endsWith('/') && route!="/") route = route.substring(0, route.length-1);
    const fragments = route.split('/');
    const lastFragment = fragments[fragments.length-1];
    let url = '';
    let parentURL = ''; 

    if(fragments.length > 1 && lastFragment==="index") fragments.pop();
    url = fragments.join('/') || '/';

    Slots.forEach(item=>{
        if(url.indexOf(item)>-1){
            parentURL = item;
        }
    });

    return { url , parentURL };
}

function getRouteMapKey(path) {
    // Convert path pattern to regex and store parameter names
    const params = [];
    const regexPath = path.replace(/\[(.*?)\]/g, (_, name) => { params.push(name); return '([^/]+)'; }).replace(/\//g, '\\/');
    
    return{
        pattern: new RegExp(`^${regexPath}$`),
        params,
    };
}