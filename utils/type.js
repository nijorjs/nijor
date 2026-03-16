import path from 'path';

export function type(filename){
    const RootPath = process.cwd();
    const srcPath = path.join(RootPath, 'src');
    filename = filename.replace(srcPath,'');
    if(filename.startsWith('/pages/')) return 'page';
    if(filename.startsWith('/layouts/')) return 'layout';
    return 'component';
}