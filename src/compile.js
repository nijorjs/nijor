import fs from 'fs';
import path from 'path';
import { Compile } from '../tools/compiler/index.js';

export default async function (w) {

    const start = performance.now();
    await Compile({ minify: false });
    const end = performance.now();
    console.log(`Compiled in ${(end - start).toFixed(2)}ms`);


    // Watch for changes in the src folder
    if (w === "-w") {
        const srcDir = path.join(process.cwd(), 'src');

        console.print('Looking for changes in the src/ folder .....', [64, 226, 73]);

        fs.watch(srcDir, { recursive: true }, async (eventType,filename) => {
            if (eventType ==='change') {
                await recompile();
                return;
            }
        });
    }
}

async function recompile() {
    const start = performance.now();
    try { await Compile({ minify: false }); } catch (error) { }
    const end = performance.now();
    console.log(`Recompiled in ${(end - start).toFixed(2)}ms`);
}