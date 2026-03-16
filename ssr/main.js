import { rolldown } from "rolldown";
import ommit from "./ommit.js";
import { Files , crawlDirectory } from '../compiler/crawler.js';
import { BuildPage } from './make-page.js';
import { getRoute } from '../utils/getRoute.js';
import fs from 'fs';
import path from 'path';

async function bundleJs(RootPath) {
    try {
        const bundle = await rolldown({
            input: path.join(RootPath, 'assets/modules/main.js'),
            plugins: [ommit()]
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

export async function Build(RootPath,eventEmitter) {
    // const RootPath = process.cwd();
    const BundledScript = await bundleJs(RootPath);
    const Template = await fs.promises.readFile(path.join(RootPath, 'index.html'), 'utf-8');

    await crawlDirectory(path.join(RootPath, 'src/pages'), 'page', false);
    let urls = new Set();
    Files.forEach(file=>{
        if(file.type == "layout") return;
        const route = getRoute(file.path);
        urls.add(route);
    });

    urls = [...urls];

    urls.forEach(async (url,index) => {

        const html = await BuildPage(Template, BundledScript, url);
        const distDir = path.join(RootPath, 'build');
        const pagesDir = path.join(distDir,'pages');

        if (!fs.existsSync(distDir)) await fs.promises.mkdir(distDir);
        if (!fs.existsSync(pagesDir)) await fs.promises.mkdir(pagesDir);

        url = url === "/" ? "index" : url;
        let pageUrl = path.join(pagesDir, `${url}.html`);
        
        await ensureDirectoryExistence(pageUrl);
        await fs.promises.writeFile(pageUrl, html);
        
        url = url === "index" ? "/" : url;
        let file = url === "/" ? "index.html" : `${url}.html`;

        let $code = ``;
        if(global.serverCodeMap.has(url)){
            $code = `
            ${[...global.serverCodeMap.get(url)].join('\n')}
            `;
        }

        let getParams = "";
        if(global.serverParamsMap.has(url)) {
            const params = global.serverParamsMap.get(url);
            if(params!=null) getParams = `let ${params} = params;`;
        }

        global.serverRoutesCode+= `
router.get('${url}',async (req,res,params)=>{
    res.writeHead(200, { 'Content-Type': 'text/html' });
    let html = await fs.promises.readFile(path.join(pagesDir,'${file}'),'utf-8');
    ${getParams}
    ${$code}
    const content = renderParams(html,params);
    res.end(content);
});
    `;

        if(index + 1 === urls.length) eventEmitter.emit('pages-built');

    });

}