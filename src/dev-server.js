import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import EventEmitter from 'events';
import { Compile } from '../tools/compiler/index.js';

const highlight = (text, [r, g, b]) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const DefaultNijorConfigServer = {
    server: {
        port: 3000,
        appdir: 'app',
        live_reload: false
    }
};

const mimeTypes = {
    '.html': 'text/html',
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

const NijorJSON = fs.existsSync(path.join(rootDir, 'nijor.config.json')) ? JSON.parse(await fs.promises.readFile(path.join(rootDir, 'nijor.config.json'), 'utf8')) : DefaultNijorConfigServer;
const hostname = '127.0.0.1';
const port = NijorJSON.server.port;

function InjectLiveServerCode(text) {
    if (!NijorJSON.server.live_reload) return text;
    return text.replace(/<head>/,
        `<head><script>
        const ws = new WebSocket('ws://localhost:${port}');
        ws.onmessage = function(event) {
        if (event.data === 'reload') {
            window.location.reload();
        }
        };
        ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        };
        </script>`);
}

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
    try {
        let data = await fs.promises.readFile(rootDir + req.url, 'utf-8');
        let ext = path.extname(req.url);
        res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
        res.writeHead(200, headers);
        res.end(data);
    } catch (error) {
        let data = fs.existsSync(rootDir + req.url + '.html') ? InjectLiveServerCode(await fs.promises.readFile(rootDir + req.url + '.html', 'utf-8')) : InjectLiveServerCode(await fs.promises.readFile(path.join(rootDir, 'index.html'), 'utf-8'));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(data);
    }
});

export default async function () {

    if (!fs.existsSync(path.join(rootDir, 'nijor.config.json'))) process.quitProgram(`Can't find 'nijor.config.json' in ${rootDir}`, [255, 0, 0]);

    const wss = new WebSocketServer({ server });
    const eventEmitter = new EventEmitter();

    server.listen(port, hostname, () => {
        console.print(`Dev Server running at http://${hostname}:${port}`, [0, 195, 255]);
        if (NijorJSON.server.live_reload) console.log(`Live Reload ${highlight('enabled', [76, 243, 16])} ; looking for changes in ${highlight('src/', [76, 243, 16])}`);
    });

    try {
        await Compile({ minify: false });
    } catch (error) {
        console.log(error);
    }

    fs.watch(srcDir, { recursive: true }, async (eventType, filename) => {
        if (eventType === 'change') {
            await recompile(eventEmitter);
            return;
        }
    });

    eventEmitter.on('compiled', async _ => {
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send('reload');
            }
        });
    });
}

async function recompile(eventEmitter) {
    try {
        const start = performance.now();
        await Compile({ minify: false });
        const end = performance.now();
        console.log(`Compiled in ${(end - start).toFixed(2)}ms`);
        eventEmitter.emit('compiled');
    } catch (error) {
        console.log(error);
    }
}