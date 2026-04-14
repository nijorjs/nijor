import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { middlewares as Middlewares, headers } from '../nijor.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname, 'assets');

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

const middlewares = [ cookieMiddleware ];

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

const indexPath = path.join(__dirname, 'index.html');

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
                    const ext = path.extname(assetPath);
                    const mimeType = mimeTypes[ext] || 'application/octet-stream';

                    const etag = `W/"${stat.size}-${stat.mtimeMs}"`; // Weak Etag
                    if (req.headers["if-none-match"] === etag) {
                        res.writeHead(304);
                        res.end();
                        return true;
                    }

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
            const content = await fs.promises.readFile(indexPath, 'utf-8');
            res.writeHead(200, {
                ...headers,
                'Content-Type': 'text/html',
                'Content-Length': Buffer.byteLength(content)
            });
            res.end(content);
            return;
        });

    } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
    }
});

if (Middlewares) {
    Middlewares?.forEach(middleware => use(middleware));
}

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}`);
});

function cookieMiddleware(req, res, next) {

    function parseCookies(cookieHeader) {
        const cookies = new Map();
        if (!cookieHeader) return cookies;

        cookieHeader.split(";").forEach(cookie => {
            const [key, ...val] = cookie.trim().split("=");
            cookies.set(key, decodeURIComponent(val.join("=")));
        });

        return cookies;
    }

    const parsedCookies = parseCookies(req.headers.cookie);
    const setCookieHeaders = [];

    req.cookies = {
        get(name) {
            return parsedCookies.get(name);
        },

        set(name, value, options = {}) {
            let cookie = `${name}=${encodeURIComponent(value)}`;

            if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
            if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
            if (options.httpOnly) cookie += `; HttpOnly`;
            if (options.secure) cookie += `; Secure`;
            if (options.path) cookie += `; Path=${options.path}`;
            if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;

            setCookieHeaders.push(cookie);
        },

        delete(name, options = {}) {
            this.set(name, "", {
                ...options,
                expires: new Date(0)
            });
        }
    }

    const originalEnd = res.end;

    res.end = function (...args) {
        if (setCookieHeaders.length > 0) {
            res.setHeader("Set-Cookie", setCookieHeaders);
        }
        return originalEnd.apply(res, args);
    };

    next();
}