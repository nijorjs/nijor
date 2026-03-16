import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import { rolldown } from "rolldown";
import { Compile } from '../compiler/index.js';
import { copyFiles } from '../utils/copydir.js';
import { Build } from '../ssr/main.js';

const RootPath = process.cwd();
const eventEmitter = new EventEmitter();

export default async function (__dirname) {

    const NijorConfigFilePath = path.join(RootPath, 'nijor.config.js');
    if (!fs.existsSync(NijorConfigFilePath)) process.quitProgram(`The file 'nijor.config.js' doesn't exist.\nNijor can't build your project !`, [255, 251, 14]);

    const config = await import(path.join(RootPath, 'nijor.config.js'));
    const outputDir = path.join(RootPath, "build");

    if (fs.existsSync(outputDir)) await fs.promises.rm(outputDir, { forced: true, recursive: true });
    await fs.promises.mkdir(outputDir);
    await fs.promises.mkdir(path.join(outputDir, 'assets'));

    let start = performance.now();
    await Compile({ minify: true });
    let end = performance.now();
    console.log(`Compiled in ${(end - start).toFixed(2)}ms`);

    start = performance.now();
    await copyFiles(path.join(RootPath, 'assets'), path.join(outputDir, 'assets'));
    end = performance.now();
    console.log(`Assets copied in ${(end - start).toFixed(2)}ms`);
    await fs.promises.copyFile(path.join(RootPath,'index.html'),path.join(outputDir, 'index.html'));

    start = performance.now();
    let serverCode = await fs.promises.readFile(path.join(__dirname, 'server/prod.js'), 'utf-8');
    const tmpFile = path.join(outputDir, 'server.tmp.js');
    await fs.promises.writeFile(tmpFile, serverCode);
    await bundle(tmpFile);
    await fs.promises.rm(tmpFile);
    end = performance.now();
    console.log(`Write the server in ${(end - start).toFixed(2)}ms`);
    console.log('Project build successfully !');

    if(config.build?.mode!="ssr") return ;

    // SSR Code (Currently Disabled)

    global.serverRoutesCode = '';
    global.serverCodeMap = new Map();
    global.serverParamsMap = new Map();

    start = performance.now();
    await Build(RootPath, eventEmitter);

    eventEmitter.on('pages-built', async () => {
        let end = performance.now();
        console.log(`Created Static Pages in ${(end - start).toFixed(2)}ms`);

        start = performance.now();
        let serverCode = await fs.promises.readFile(path.join(__dirname, 'ssr/server.js'), 'utf-8');
        serverCode = serverCode.replaceAll('/*--seed--*/', process.seed);
        serverCode = serverCode.replace('//@Routes', global.serverRoutesCode);
        // serverCode = serverCode.replace('//@ServerFunctions', process.nijor.server.functions);
        const tmpFile = path.join(outputDir, 'server.tmp.js');
        await fs.promises.writeFile(tmpFile, serverCode);
        await bundle(tmpFile);
        await fs.promises.rm(tmpFile);

        end = performance.now();

        console.log(`Created server.js in ${(end - start).toFixed(2)}ms`);
        console.log('Project Built successfully !');
    });

}

async function bundle(input) {
    try {
        const bundle = await rolldown({ 
            input, 
            onLog : _ => { }
        });
        await bundle.write({
            file: input.replace('.tmp.js','.js'),
            format: 'es',
        });
        await bundle.close();
    } catch (err) { console.log(err) }
}