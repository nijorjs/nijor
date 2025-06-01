import fs from 'fs';
import path from 'path';
import {Compile} from '../tools/compiler/index.js';

export default async function (watch) {
    
    const start = performance.now();
    await Compile({ minify: false });
    const end = performance.now();
    console.log(`Compiled in ${(end - start).toFixed(2)}ms`);


    // Watch for changes in the src folder
    if (watch === "-w") {
        console.print('Looking for changes in the src/ folder .....', [64, 226, 73]);
        fs.watch(path.join(process.cwd(), 'src'),{recursive:true},async _=>{
            const start = performance.now();
            await Compile({ minify: false });
            const end = performance.now();
            console.log(`Recompiled in ${(end - start).toFixed(2)}ms`);
        });
    }

}