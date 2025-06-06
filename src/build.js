import fs from 'fs';
import path from 'path';
import { Compile } from '../tools/compiler/index.js';
import { copyFiles } from '../utils/copydir.js';
import { Build } from '../tools/builder/index.js';

const RootPath = process.cwd();

export default async function (__dirname) {

    const NijorConfigFilePath = path.join(RootPath,'nijor.config.json');

    if (!fs.existsSync(NijorConfigFilePath)) process.quitProgram(`The file 'nijor.config.json' doesn't exist. So, Nijor Compiler can't build your project.`, [255, 251, 14]);
    
    const NijorConfigFile = JSON.parse(await fs.promises.readFile(NijorConfigFilePath, 'utf8'));
    const outputDir = path.join(RootPath, NijorConfigFile.app.dir);

    const start = performance.now();

    await Compile({ minify: true });
    if (fs.existsSync(outputDir)) await fs.promises.rm(outputDir,{forced:true, recursive:true});
    await fs.promises.mkdir(outputDir);
    await fs.promises.mkdir(path.join(outputDir,'assets'));
    await fs.promises.mkdir(path.join(outputDir,'pages'));
    await fs.promises.copyFile(path.join(RootPath, 'index.html'), path.join(outputDir,'pages', 'index.html'));
    await fs.promises.copyFile(path.join(__dirname,'tools/server/prod.js'),path.join(outputDir,'server.js'));
    await copyFiles(path.join(RootPath, 'assets'), path.join(outputDir, 'assets'));
    
    const end = performance.now();

    console.log(`Built in ${(end - start).toFixed(2)}ms`);

    if (NijorConfigFile.app.type==="ssr"){
        const start = performance.now();
        await Build(RootPath);
        const end = performance.now();
        console.log(`Created Static Pages in ${(end - start).toFixed(2)}ms`);
    }

}