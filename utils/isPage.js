import path from 'path';

export function isPage(filename){
    const RootPath = process.cwd();
    const srcPath = path.join(RootPath, 'src');
    filename = filename.replace(srcPath,'');
    if(filename.startsWith('/pages/')) return true;
    return false;
}