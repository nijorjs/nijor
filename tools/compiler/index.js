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
import uniqeid from '../../utils/uniqeid.js';
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
    'nijor/page': path.join(__dirname, 'runtime/page.js'),
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

  try {
    await fs.promises.rm(path.join(RootPath, NijorJSON.module.output), { recursive: true, force: true }); // Delete the modules folder from assets
  } catch (error) { }

  if (!fs.existsSync(path.join(RootPath, 'assets'))) await fs.promises.mkdir(path.join(RootPath, 'assets'));

  let styleSheet = await fs.promises.readFile(path.join(RootPath, NijorJSON.styles.input), 'utf-8');
  styleSheet = await ModifyCSS(styleSheet);
  await fs.promises.writeFile(compilerOptions.styleSheet, styleSheet);

  const bundle = await rolldown({
    input: 'main',
    plugins: [
      includepaths(includePathOptions),
      json(),
      nodeResolve(),
      virtual({ main: `${await crawl(path.join(RootPath, 'src'))}` }),
      image(),
      compiler(compilerOptions),
      options.minify && terser()
    ],
    onwarn: (msg) => { }
  });

  await bundle.write({
    dir: path.join(RootPath, NijorJSON.module.output),
    format: 'es',
    chunkFileNames : chunkFileNames
  });

  await bundle.close();

  const styleModules = await loadStyleModules(path.join(RootPath, NijorJSON.styles.modules));
  const minifiedStyle = minifyCSS(treeshake_style(styleModules, process.cssClasses));
  await fs.promises.appendFile(compilerOptions.styleSheet, minifiedStyle);
}

function renameFile(filepath, name) {
  let filename = "";
  let isPage = false;
  if(filepath.indexOf(srcPath)>-1) {
    filename = filepath.replace(srcPath,'');
    if(filename.startsWith('/pages')) {
      filename = filename.replace('/pages','').slice(0,-6).replace('/','').replaceAll('/','-').replaceAll('[','-').replaceAll(']','-');
      isPage = true;
      return [filename+'.js',isPage];
    }

  }
  filename = name + '-' + uniqeid(3,5) + '.js';
  return [filename,isPage];
}

function chunkFileNames(file) {
  const filename = file.moduleIds.reverse()[0];
  const [outputFileName, isPage] = renameFile(filename, file.name);

  if (isPage) {

    const route = getRoute(filename);
    if (route.endsWith('/_')) return outputFileName;

    process.sourceMap[route] = {
      file: outputFileName
    };
  }

  return outputFileName;
}