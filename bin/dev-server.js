import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import EventEmitter from 'events';
import { Compile } from '../compiler/index.js';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const assetsDir = path.join(rootDir, 'assets');
const indexPath = path.join(rootDir, 'index.html');

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

/* ------------------------- Utils ------------------------- */

const highlight = (text, [r, g, b]) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;

function getLocalIpAddress() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            const isIPv4 = typeof net.family === 'string' ? net.family === 'IPv4' : net.family === 4;
            if (isIPv4 && !net.internal) return net.address;
        }
    }
    return null;
}

/* ------------------------- Live Reload ------------------------- */

function injectLiveReload(html, port, enabled) {
    if (!enabled) return html;

    return html.replace(
        /<head>/,
        `<head><script>
        const ws = new WebSocket(\`ws://\${location.hostname}:${port}\`);
        ws.onmessage = e => e.data === 'reload' && location.reload();
        ws.onclose = () => {
            const retry = () => {
                const ws = new WebSocket(\`ws://\${location.hostname}:${port}\`);
                ws.onopen = () => location.reload();
                ws.onerror = () => setTimeout(retry, 2000);
            };
            retry();
        };
        </script>`
    );
}

/* ------------------------- Middleware ------------------------- */

const middlewares = [];

function use(fn) {
    middlewares.push(fn);
}

async function runMiddlewares(req, res, handler) {
    let i = 0;

    const next = async () => {
        if (i < middlewares.length) {
            await middlewares[i++](req, res, next);
        } else {
            await handler();
        }
    };

    await next();
}

/* ------------------------- Server ------------------------- */

export default async function (version) {
    await loadEnv();

    const nijor_config = await import(path.join(rootDir, 'nijor.config.js'));
    const port = nijor_config.server.port;
    const hostname = '0.0.0.0';

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET'
    };

    if (nijor_config.middlewares) {
        nijor_config.middlewares.forEach(mw => {
            if (typeof mw !== 'function') {
                console.warn('[Nijor] Middleware must be a function');
                return;
            }
            use(mw);
        });
    }

    const server = http.createServer(async (req, res) => {
        try {
            await runMiddlewares(req, res, async () => {

                if (req.url === "/index.html") {
                    res.writeHead(302, { location: '/' });
                    return res.end();
                }

                const requestPath = decodeURIComponent(req.url.split('?')[0]);
                const filePath = path.join(assetsDir, requestPath);

                /* ---------- Serve static assets ---------- */
                if (fs.existsSync(filePath)) {
                    const stat = await fs.promises.stat(filePath);

                    if (stat.isFile()) {
                        const ext = path.extname(filePath);
                        const mime = mimeTypes[ext] || 'application/octet-stream';

                        const content = await fs.promises.readFile(filePath);

                        res.writeHead(200, {
                            ...headers,
                            'Content-Type': mime,
                            'Content-Length': Buffer.byteLength(content),
                        });

                        return res.end(content);
                    }
                }

                /* ---------- Fallback: index.html ---------- */
                let html = await fs.promises.readFile(indexPath, 'utf-8');
                html = injectLiveReload(html, port, nijor_config.server.live_reload);

                res.writeHead(200, headers);
                res.end(html);
            });

        } catch (err) {
            console.error(err);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });

    /* ------------------------- WebSocket ------------------------- */

    const wss = new WebSocketServer({ server });
    const emitter = new EventEmitter();

    emitter.on('compiled', () => {
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send('reload');
            }
        });
    });

    /* ------------------------- Compile System ------------------------- */

    let compiling = false;
    let pending = false;
    let debounceTimer;

    async function triggerCompile() {
        if (compiling) {
            pending = true;
            return;
        }

        compiling = true;

        try {
            const start = performance.now();
            await Compile({ dev: true });
            const end = performance.now();

            console.log(`Compiled in ${(end - start).toFixed(2)}ms`);
            emitter.emit('compiled');
        } catch (err) {
            console.error(err);
        }

        compiling = false;

        if (pending) {
            pending = false;
            triggerCompile();
        }
    }

    /* ------------------------- Watcher (FIXED) ------------------------- */

    function startWatcher() {
        const watcher = chokidar.watch(srcDir, {
            ignoreInitial: true,
        });

        watcher.on('all', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(triggerCompile, 50);
        });
    }

    /* ------------------------- Start ------------------------- */

    const ip = getLocalIpAddress();

    server.listen(port, hostname, () => {
        console.print(`Nijor v${version}`, [0, 195, 255]);
        console.log(`Local : http://localhost:${port}`);
        if (ip) console.log(`Network : http://${ip}:${port}`);
        if (nijor_config.server.live_reload) console.log(`Live Reload ${highlight('enabled', [76, 243, 16])} ; looking for changes in ${highlight('src/', [76, 243, 16])}`);
    });

    await triggerCompile(); // initial build
    startWatcher();
}

/* ------------------------- ENV ------------------------- */

async function loadEnv() {
    const envPath = path.join(rootDir, '.env');
    if (!fs.existsSync(envPath)) return;
    const content = await fs.promises.readFile(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (!key || !val.length || key.startsWith('#')) return;
        process.env[key.trim()] = val.join('=').trim().replace(/^["']|["']$/g, '');
    });
}