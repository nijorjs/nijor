import fs from 'fs';
import path from 'path';
import {copyFiles} from '../utils/copydir.js';

export default async function(cwDir,__dirname,name){

    const TemplateDirectory = path.join(__dirname,'template');

    if(!name){
      console.print("{name} missing in 'nijor create {name}'",[255,251,14]);
      return;
    }
    
    let dir = path.join(cwDir,name);

    const start = performance.now();
  
    if(fs.existsSync(dir)){
        console.print(`The directory '${name}' already exists. Please choose a different name or remove the existing directory.`,[255,251,14]);
        return;
    }

    await fs.promises.mkdir(dir,{recursive:true});
    await copyFiles(TemplateDirectory,dir);
    
    const NijorConfigFilePath = path.join(dir,'nijor.config.json');
    const nijorConfigFile = JSON.parse(await fs.promises.readFile(NijorConfigFilePath, 'utf8'));
    nijorConfigFile.app.name = name;
    await fs.promises.writeFile(path.join(dir,'nijor.config.json'), JSON.stringify(nijorConfigFile,null,4));

    const end = performance.now();

    console.print(`Created your project in ${(end - start).toFixed(2)}ms`,[0,195,255]);

}