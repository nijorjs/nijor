import { Files,crawlDirectory } from '../compiler/crawler.js';
import { BuildPage } from './make-page.js';
import { minifyHTML } from '../../utils/minify.js';
import { rolldown } from 'rolldown';
import fs from 'fs';
import path from 'path';

async function bundleJs(RootPath) {
    try {
        const bundle = await rolldown({
            input: path.join(RootPath, 'assets/modules/app.js'),
            plugins: [],
        });
        const { output } = await bundle.generate({
            format: 'iife',
            name: 'app'
        });
        await bundle.close();
        return output[0].code;
    } catch (err) { }
}

async function ensureDirectoryExistence(filePath) {
    let dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    await ensureDirectoryExistence(dirname);
    await fs.promises.mkdir(dirname);
}

export async function Build(RootPath) {
    // const RootPath = process.cwd();
    const BundledScript = await bundleJs(RootPath);
    const Template = await fs.promises.readFile(path.join(RootPath, 'index.html'), 'utf-8');

    await crawlDirectory(path.join(RootPath, 'src/pages'));
    const urls = new Set();
    Files.forEach(file=>{
        const route = getRoute(file);
        if(route.endsWith("/_")) return;
        urls.add(route);
    });

    urls.forEach(async url => {
        const html = await BuildPage(Template, BundledScript, url);
        const distDir = path.join(RootPath, 'build');
        const pagesDir = path.join(distDir,'pages');

        if (!fs.existsSync(distDir)) await fs.promises.mkdir(distDir);
        if (!fs.existsSync(pagesDir)) await fs.promises.mkdir(pagesDir);

        url = url === "/" ? "index" : url;
        let pageUrl = path.join(pagesDir, `${url}.html`);

        await ensureDirectoryExistence(pageUrl);
        await fs.promises.writeFile(pageUrl, minifyHTML(html));
    });

    // Handling the Routing Logic for the server side
    urls.forEach(url=>{
        let file = url === "/" ? "index.html" : `${url}.html`;
        global.serverRoutesCode+= `
router.get('${url}',async (req,res,params)=>{
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const content = renderParams(await fs.promises.readFile(path.join(pagesDir,'${file}'),'utf-8'),params);
    res.end(content);
});
    `;
    });

}

function getRoute(filepath){
    filepath = filepath.replace(/\\/g,'/');
    let route = '/'+filepath.split('src/pages/')[1].replace('.nijor','');
    if(route.endsWith('/') && route!="/") route = route.substring(0, route.length-1);
    const fragments = route.split('/');
    const lastFragment = fragments[fragments.length-1];
    let url = '';

    if(fragments.length > 1 && lastFragment==="index") fragments.pop();
    url = fragments.join('/') || '/';

    return url;
}