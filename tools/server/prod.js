import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname,'assets');
const pagesDir = path.join(__dirname,'pages');

const mimeTypes = {
  '.html': 'text/html;charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer(async (req, res) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    };
    if (req.url == "/index.html") {
        res.writeHead(302, { location: '/' });
        res.end();
        return;
    }
    if(req.url.startsWith("/assets")){
        let ext = path.extname(req.url);
        try {
            let data = await fs.promises.readFile(publicDir + req.url.replace('/assets', ''));
            res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
            res.writeHead(200, headers);
            res.end(data);
            return;
        } catch (error) {
            res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
            res.writeHead(200, headers);
            res.end('no icon found');
            return;
        }
    }

    let data = fs.existsSync(pagesDir + req.url + '.html') ? await fs.promises.readFile(pagesDir + req.url + '.html', 'utf-8') : await fs.promises.readFile(path.join(pagesDir, 'index.html'), 'utf-8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(data);
    return;

});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}`);
});