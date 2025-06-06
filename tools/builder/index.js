import { Files, getRouteFromFilePath, crawlDirectory } from '../compiler/crawler.js';
import { BuildPage } from './make-page.js';
import { rolldown } from 'rolldown';
import { minifyHTML } from '../../utils/minify.js';
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

export async function Build(RootPath) {
    // const RootPath = process.cwd();
    const BundledScript = await bundleJs(RootPath);
    const Template = await fs.promises.readFile(path.join(RootPath, 'index.html'), 'utf-8');
    
    await crawlDirectory(path.join(RootPath, 'src/pages'));
    const urls = Files.map(file => {
        if(typeof file === 'string'  && file.endsWith("/_'")) return;
        getRouteFromFilePath(file).url.replace(/'/g, '')
    });

    urls.forEach(async url => {
        const html = await BuildPage(Template, BundledScript, url);
        const distDir = path.join(RootPath, 'build');
        const pagesDir = path.join(distDir,'pages');

        if (!fs.existsSync(distDir)) await fs.promises.mkdir(distDir);
        if (!fs.existsSync(pagesDir)) await fs.promises.mkdir(pagesDir);


        url = url === "/" ? "index" : url;

        await fs.promises.writeFile(path.join(pagesDir, `${url}.html`), minifyHTML(html));
    });
}