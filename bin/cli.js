#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import createProject from '../src/create.js';
import buildProject from '../src/build.js';
import compileProject from '../src/compile.js';
import serveProject from '../src/serve.js';

const cwDir = process.cwd();
const __dirname = path.join(path.dirname(fileURLToPath(import.meta.url)),'../'); // The root level of nijor

console.print = (text,[r, g, b]) => console.log(`\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`); // colored console output

process.quitProgram = (msg,[r=256, g=256, b=256]) => {
  console.print(msg,[r, g, b]);
  process.exit(1);
}

const userArgs = process.argv.slice(2);

const commandsMap = {
    "create": () => createProject(cwDir,__dirname,userArgs[1]),
    "build": ()=> buildProject(__dirname),
    "compile": ()=> compileProject(userArgs[1]),
    "serve": ()=> serveProject(),
    "-v": ()=> console.log('v4.5.5'),
    "default": ()=> DefaultCommand()
}

function DefaultCommand(){
    console.print("Welcome to the Nijor CLI !",[0,195,255]);
    console.print("version : 4.5.5",[0,195,255]);
}

try {
    commandsMap[userArgs[0]]();
} catch (error) {
    commandsMap['default']();
}