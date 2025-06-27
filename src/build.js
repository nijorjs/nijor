import fs from 'fs';
import path from 'path';
import { Compile } from '../tools/compiler/index.js';
import { copyFiles } from '../utils/copydir.js';
import { Build } from '../tools/builder/index.js';

const RootPath = process.cwd();

export default async function (__dirname) {

    const NijorConfigFilePath = path.join(RootPath,'nijor.config.json');

    if (!fs.existsSync(NijorConfigFilePath)) process.quitProgram(`The file 'nijor.config.json' doesn't exist.\nNijor can't build your project !`, [255, 251, 14]);

    const config = JSON.parse(await fs.promises.readFile(NijorConfigFilePath, 'utf8'));
    const outputDir = path.join(RootPath, config.app.dir);

    if (!['spa','ssr'].includes(config.app.type)){
        process.quitProgram(`app type "${config.app.type}" not recognized in nijor.config.json\nValid app types are "spa" and "ssr`,[255, 251, 14]);
    }

    if (fs.existsSync(outputDir)) await fs.promises.rm(outputDir,{forced:true, recursive:true});
    await fs.promises.mkdir(outputDir);
    await fs.promises.mkdir(path.join(outputDir,'assets'));
    await fs.promises.mkdir(path.join(outputDir,'pages'));

    let start = performance.now();
    await Compile({ minify: true });
    let end = performance.now();
    console.log(`Compiled in ${(end - start).toFixed(2)}ms`);
    
    start = performance.now();
    await copyFiles(path.join(RootPath, 'assets'), path.join(outputDir, 'assets'));
    end = performance.now();
    console.log(`Assets copied in ${(end - start).toFixed(2)}ms`);

    if(config.app.type==="spa"){
        await fs.promises.copyFile(path.join(RootPath, 'index.html'), path.join(outputDir,'pages', 'index.html'));
        await fs.promises.copyFile(path.join(__dirname,'tools/server/prod.js'),path.join(outputDir,'server.js'));
        console.log('Project Built successfully !');
    }

    if (config.app.type==="ssr"){

        global.serverRoutesCode = '';

        let start = performance.now();
        await Build(RootPath);
        let end = performance.now();
        console.log(`Created Static Pages in ${(end - start).toFixed(2)}ms`);

        start = performance.now();
        let serverCode = await fs.promises.readFile(path.join(__dirname,'tools/server/ssr.js'),'utf-8');
        serverCode = serverCode.replace('//@Routes',global.serverRoutesCode);
        await fs.promises.writeFile(path.join(outputDir,'server.js'),serverCode);
        end = performance.now();  

        console.log(`Created server.js in ${(end - start).toFixed(2)}ms`);
        console.log('Project Built successfully !');
    }
    
}