import { rolldown } from 'rolldown';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import image from '@rollup/plugin-image';
import includepaths from './includepaths.js';
import virtual from './virtual.js';
import { crawl } from './crawler.js';
import compiler from './plugin/index.js';
import { ModifyCSS } from './plugin/style.js';
import { minifyCSS } from '../../utils/minify.js';
import { getRoute } from '../../utils/getRoute.js';
import { treeshake as treeshake_style } from './plugin/css-treeshake.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

process.cssClasses = new Set();
process.staticTemplate = new Set();
process.serverCodeMap = new Map();
process.serverParamsMap = new Map();
process.serverFunctions = '';
process.seed = '0'.repeat(Math.floor(Math.random() * 3) + 1);
process.sourceMap = {};

const __dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../'); // The root level of nijor
const RootPath = process.cwd();
const srcPath = path.join(RootPath, 'src');

const includePathOptions = {
  include: {
    'nijor': path.join(__dirname, 'runtime/nijor.js'),
    'nijor/component': path.join(__dirname, 'runtime/component.js'),
    'nijor/router': path.join(__dirname, 'runtime/router.js'),
    'nijor/theme': path.join(__dirname, 'runtime/theme.js'),
    'nijor/reactivity': path.join(__dirname, 'runtime/reactivity.js')
  },
  paths: [srcPath],
  external: [],
  extensions: ['.js', '.nijor', 'json']
};

async function loadStyleModules(dirPath) {
  if (!fs.existsSync(dirPath)) await fs.promises.mkdir(dirPath);
  try {
    const files = await fs.promises.readdir(dirPath);
    const fileContents = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dirPath, file);
        return fs.promises.readFile(filePath, 'utf-8');
      })
    );
    return fileContents.join('\n');
  } catch (error) {
    console.error('Error reading files:', error);
    return '';
  }
}

export async function Compile(options) {

  const NijorJSON = JSON.parse(await fs.promises.readFile(path.join(RootPath, 'nijor.config.json'), 'utf8'));

  const compilerOptions = {
    rootdir: __dirname,
    styleSheet: path.join(RootPath, NijorJSON.styles.output)
  }

  const bundle = await rolldown({
    input: 'app',
    plugins: [
      includepaths(includePathOptions),
      json(),
      nodeResolve(),
      virtual({ app: `${await crawl(path.join(RootPath, 'src'))}` }),
      image(),
      compiler(compilerOptions),
      options.minify && terser()
    ],
    onwarn: (msg) => { }
  });

  try {
    await fs.promises.rm(path.join(RootPath, NijorJSON.module.output), { recursive: true, force: true }); // Delete the modules folder from assets
  } catch (error) { }

  if (!fs.existsSync(path.join(RootPath, 'assets'))) await fs.promises.mkdir(path.join(RootPath, 'assets'));

  let styleSheet = await fs.promises.readFile(path.join(RootPath, NijorJSON.styles.input), 'utf-8');
  styleSheet = await ModifyCSS(styleSheet);
  fs.promises.writeFile(compilerOptions.styleSheet, styleSheet);

  await bundle.write({
    dir: path.join(RootPath, NijorJSON.module.output),
    format: 'es',
    chunkFileNames : chunkFileNames
  });

  const styleModules = await loadStyleModules(path.join(RootPath, NijorJSON.styles.modules));
  const minifiedStyle = minifyCSS(treeshake_style(styleModules, process.cssClasses));
  await fs.promises.appendFile(compilerOptions.styleSheet, minifiedStyle);
}

function renameFile(filename, seed) {
  let prefix = "";
  let typeModule = "unkown";
  if(filename.indexOf(__dirname)>-1) {
    let output = filename.replace(path.join(__dirname,'runtime'),'');
    output = output.split('/').join('');
    return [output, typeModule];
  }
  filename = filename.replace(srcPath, '');
  if (filename.endsWith('.nijor')) filename = filename.slice(0, -6);
  let chunks = filename.split('/');
  chunks.reverse().pop();
  chunks.reverse();
  if (chunks[0] === "pages") { prefix = 'p_'; typeModule = "page"; }
  if (chunks[0] === "components") { prefix = 'c_'; typeModule = "component"; }
  chunks.reverse().pop();
  if (chunks[0] === '_') chunks[0] = 's_';
  chunks.reverse();
  let output = prefix + chunks.join('_' + seed + '_').replaceAll('[','--').replaceAll(']','--');
  if(!output.endsWith('.js')) output = output+'.js';
  return [output, typeModule];
}

function chunkFileNames(file) {
  const filename = file.moduleIds.reverse()[0];
  const [outputFileName, typeModule] = renameFile(filename, process.seed);

  if (typeModule === "page") {

    const route = getRoute(filename);
    if (route.endsWith('/_')) return outputFileName;

    let $imports = [];

    file.moduleIds.reverse().pop();
    file.moduleIds.forEach(f => {
      $imports.push(renameFile(f, process.seed)[0]);
    });

    process.sourceMap[route] = {
      file: outputFileName,
      depends: $imports
    };
  }

  return outputFileName;
}