import fs from 'fs';
import path from 'path';
import { copyFiles } from '../utils/copydir.js';

export default async function(cwDir,__dirname,args){

    const name = args[0];
    let template = "blank";
    
    if(args[1] === "-t" || args[1]==="--template"){
        template = args[2];
    }
    
    const TemplateDirectory = path.join(__dirname,'template',template);

    if(!name){
      console.print("{name} missing in 'nijor create {name}'",[255,251,14]);
      return;
    }
    
    const project_dir = path.join(cwDir,name);

    if(fs.existsSync(project_dir)){
        console.log(`The directory '${name}' already exists.`);
        console.log('Please choose a different name or remove the existing directory.');
        return;
    }
    
    if(!fs.existsSync(TemplateDirectory)){
        console.log(`The template '${template}' doesn't exist !`);
        console.log('Available templates : blank (default), tailwind');
        return;
    }

    await fs.promises.mkdir(project_dir,{ recursive:true });
    await copyFiles(TemplateDirectory,project_dir);

    console.log("Nijor project created !");
    console.log("Template used :", template);
    console.log("cd", name);
    console.log("nijor dev");
}