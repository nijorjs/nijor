import { rolldown } from 'rolldown';
import image from '@rollup/plugin-image';
import virtual from './helpers/virtual.js';
import { crawl } from './crawler.js';
import compiler from './nijor-compiler.js';
import { ModifyCSS } from './style.js';
import { getRoute } from '../utils/getRoute.js';
import uniqeid from '../utils/uniqeid.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

process.seed = '0'.repeat(Math.floor(Math.random() * 3) + 1);
process.sourceMap = {};
process.metadataMap = new Map();
process.layoutMap = new Map();

const __dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), '../'); // The root level of nijor
const RootPath = process.cwd();
const srcPath = path.join(RootPath, 'src');

export async function Compile(options) {

  try {
    await fs.promises.rm(path.join(RootPath, "assets/modules"), { recursive: true, force: true }); // Delete the modules folder from assets
  } catch (error) { }

  if (!fs.existsSync(path.join(RootPath, 'assets'))) await fs.promises.mkdir(path.join(RootPath, 'assets'));

  let styleSheet = await fs.promises.readFile(path.join(RootPath, "src/styles/style.css"), 'utf-8');
  styleSheet = await ModifyCSS(styleSheet);
  const stylesheetPath = path.join(RootPath, "assets/style.css");
  await fs.promises.writeFile(stylesheetPath, styleSheet);

  const bundle = await rolldown({
    input: 'main',
    resolve: {
      alias: {
        '@': srcPath,
        'nijor': path.join(__dirname, 'runtime'),
      }
    },
    plugins: [
      virtual({ main: `${await crawl(path.join(RootPath, 'src'))}` }),
      image(),
      compiler({ root : RootPath, stylesheetPath })
    ],
    onLog : msg => {}
  });

  await bundle.write({
    dir: path.join(RootPath, "assets/modules"),
    format: 'es',
    minify: options.minify,
    chunkFileNames
  });

  await bundle.close();
}

function renameFile(filepath, name) {
  let filename = "";
  if (filepath?.indexOf(srcPath) > -1) {
    filename = filepath.replace(srcPath, '');

    if (filename.startsWith('/pages')) {
      filename = filename.replace('/pages', '').slice(0, -6).replace('/', '').replaceAll('/', '-').replaceAll('[', '-').replaceAll(']', '-');
      return `pages/${filename}.js`;
    }

    if (filename.startsWith('/layouts')) {
      filename = filename.replace('/layouts', '').slice(0, -6).replace('/', '').replaceAll('/', '-').replaceAll('[', '-').replaceAll(']', '-');
      return `layout/${filename}.js`;
    }

  }
  filename = name + '-' + uniqeid(3, 5) + '.js';
  return filename;
}

function chunkFileNames(file) {
  const filename = file.facadeModuleId || file.moduleIds.reverse()[0];
  const outputFileName = renameFile(filename, file.name);

  if(mod_type(filename)=="page"){
    const route = getRoute(filename);
    process.sourceMap[route] = {
      file: outputFileName
    }; 
  }
  
  return outputFileName;
}

function mod_type(filename) {
    const RootPath = process.cwd();
    const srcPath = path.join(RootPath, 'src');
    filename = filename.replace(srcPath, '');
    if (filename.startsWith('/pages/')) return 'page';
    if (filename.startsWith('/layouts/')) return 'layout';
    return 'component';
}