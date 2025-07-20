#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import createProject from '../src/create.js';
import buildProject from '../src/build.js';
import compileProject from '../src/compile.js';
import devServer from '../src/dev-server.js';

const cwDir = process.cwd();
const __dirname = path.join(path.dirname(fileURLToPath(import.meta.url)),'../'); // The root level of nijor

const highlight = (text, [r,g,b])=> `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
console.print = (text,[r, g, b]) => console.log(highlight(text,[r,g,b])); // colored console output

process.quitProgram = (msg,[r=256, g=256, b=256]) => {
  console.print(msg,[r, g, b]);
  process.exit(1);
}

const userArgs = process.argv.slice(2);

const commandsMap = {
    "create": () => createProject(cwDir,__dirname,userArgs[1]),
    "build": ()=> buildProject(__dirname),
    "compile": ()=> compileProject(userArgs[1]),
    "dev": ()=> devServer(),
    "-v": ()=> console.log('v5.2.2'),
    "default": ()=> DefaultCommand()
}

function DefaultCommand(){
    const command = userArgs[0];
    if(!!!command) console.print("Welcome to the Nijor CLI !\n",[0,195,255]);
    if(command) console.log(`"${highlight(command,[255,251,14])}" is not recognized by the ${highlight('Nijor CLI',[0,195,255])} ! \n`);
    console.log(`The following commands are available :`);
    console.log(`   ${highlight('create',[255,251,14])} : For creating a new project`);
    console.log(`   ${highlight('compile',[255,251,14])} : For compiling a project in dev mode`);
    console.log(`   ${highlight('build',[255,251,14])} : For building a project in production mode`);
    console.log(`   ${highlight('dev',[255,251,14])} : For starting the dev server`);
    console.log(`   ${highlight('-v',[255,251,14])} : To check version \n`);
    console.log(`For more information, check docs at ${highlight('https://nijorjs.github.io',[0,195,255])}`);
}

try {
    commandsMap[userArgs[0]]();
} catch (error) {
    commandsMap['default']();
}