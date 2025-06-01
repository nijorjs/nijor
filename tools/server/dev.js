import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';

const rootDir = process.cwd();
const DefaultNijorConfigServer = {
    server: {
        port: 3000,
        appdir: 'app'
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

const NijorJSON = JSON.parse(await fs.promises.readFile(path.join(rootDir, 'nijor.config.json'), 'utf8')) || DefaultNijorConfigServer;
const hostname = '127.0.0.1';
const port = NijorJSON.server.port;

function InjectLiveServerCode(text){
    if(!NijorJSON.server.live_reload) return text;
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

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('error', console.error);
});

fs.watch(rootDir, { recursive: true }, _ => {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send('reload');
    }
  });
});

server.listen(port, hostname, () => {
    console.print(`Server running at http://${hostname}:${port}`, [0, 195, 255]);
});