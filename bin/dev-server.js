import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import EventEmitter from 'events';
import { Compile } from '../compiler/index.js';

const highlight = (text, [r, g, b]) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');

export default async function () {
    const assetsDir = path.join(rootDir, 'assets');

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

    const nijor_config = await import(path.join(rootDir, 'nijor.config.js'));
    const hostname = '0.0.0.0';
    const port = nijor_config.server.port;

    function InjectLiveServerCode(text) {
        if (!nijor_config.server.live_reload) return text;
        return text.replace(/<head>/,`<head><script>
        const ws = new WebSocket(\`ws://\${location.hostname}:${port}\`);
        ws.onmessage = (event) => {
            if (event.data === 'reload') {
                window.location.reload();
            }
        };
        ws.onclose = () => {
            console.log('Server is down. Waiting for it to come back online...');
            checkServerAndReload();
        };
        function checkServerAndReload() {
            const tempWs = new WebSocket(\`ws://\${location.hostname}:${port}\`);
            tempWs.onopen = () => {
                tempWs.close();
                window.location.reload();
            };
            tempWs.onerror = () => {
                setTimeout(checkServerAndReload, 3000);
                tempWs.close();
            };
        }
        </script>`);
    }

    const middlewares = [];

    function use(fn) {
        middlewares.push(fn);
    }

    async function runMiddlewares(req, res, finalHandler) {
        let i = -1;

        const next = async () => {
            i++;
            if (i < middlewares.length) {
                await middlewares[i](req, res, next);
            } else {
                await finalHandler();
            }
        };

        await next();
    }

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    };

    const indexPath = path.join(rootDir, 'index.html');

    const server = http.createServer(async (req, res) => {
        try {
            await runMiddlewares(req, res, async () => {

                if (req.url === "/index.html") {
                    res.writeHead(302, { location: '/' });
                    return res.end();
                }

                const requestPath = decodeURIComponent(req.url.split('?')[0]);
                const assetPath = path.join(assetsDir, requestPath);

                if (fs.existsSync(assetPath)) {
                    const stat = await fs.promises.stat(assetPath);
                    if (stat.isFile()) {
                        const etag = `W/"${stat.size}-${stat.mtimeMs}"`; // Weak Etag
                        if (req.headers["if-none-match"] === etag) {
                            res.writeHead(304);
                            res.end();
                            return true;
                        }

                        const ext = path.extname(assetPath);
                        const mimeType = mimeTypes[ext] || 'application/octet-stream';
                        const content = await fs.promises.readFile(assetPath);
                        res.writeHead(200, {
                            ...headers,
                            'Content-Type': mimeType,
                            'Content-Length': Buffer.byteLength(content),
                            "Cache-Control": "public, max-age=0",
                            "ETag": etag
                        });
                        res.end(content);
                        return;
                    }
                }

                // Serve the index.html file for all routes
                const content = InjectLiveServerCode(await fs.promises.readFile(indexPath, 'utf-8'));
                res.writeHead(200, headers);
                res.end(content);
                return;
            });

        } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
        }
    });

    if (nijor_config.middlewares) {
        nijor_config.middlewares?.forEach(middleware => use(middleware));
    }

    // export default async function () {

    const IP_Addr = getLocalIpAddress();

    if (!fs.existsSync(path.join(rootDir, 'nijor.config.js'))) process.quitProgram(`Can't find 'nijor.config.js' in ${rootDir}`, [255, 0, 0]);

    const wss = new WebSocketServer({ server });
    const eventEmitter = new EventEmitter();

    server.listen(port, hostname, () => {
        console.print(`Nijor`, [0, 195, 255]);
        console.log(`Local : http://localhost:${port}`);
        if (IP_Addr) console.log(`Network : http://${IP_Addr}:${port}`);
        if (nijor_config.live_reload) console.log(`Live Reload ${highlight('enabled', [76, 243, 16])} ; looking for changes in ${highlight('src/', [76, 243, 16])}`);
    });

    try {
        await Compile({ minify: false });
    } catch (error) {
        console.log(error);
    }

    // fs.watch(srcDir, { recursive: true }, async (eventType, filename) => {
    //     if (eventType === 'change') {
    //         await recompile(eventEmitter);
    //         return;
    //     }
    // });

    startWatching(eventEmitter);

    eventEmitter.on('compiled', async _ => {
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send('reload');
            }
        });
    });
}

let watcher;

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

function startWatching(eventEmitter) {
    watcher = fs.watch(srcDir, { recursive: true }, async (eventType, filename) => {
        if(eventType=="change") await recompile(eventEmitter);
        watcher.close();
        startWatching(eventEmitter);
    });
}

function getLocalIpAddress() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
            if (net.family === familyV4Value && !net.internal) {
                return net.address;
            }
        }
    }
    return null;
}