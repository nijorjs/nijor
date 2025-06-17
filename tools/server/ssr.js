import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname,'assets');
const pagesDir = path.join(__dirname,'pages');
const PORT = 3000;

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

class Router {
    constructor() {
        this.routes = new Map();
    }

    // Only GET requests
    get(path, handler) {
        // Convert path pattern to regex and store parameter names
        const paramNames = [];
        const regexPath = path
            .replace(/\[(.*?)\]/g, (_, name) => {
                paramNames.push(name);
                return '([^/]+)';
            })
            .replace(/\//g, '\\/');
        
        this.routes.set({
            pattern: new RegExp(`^${regexPath}$`),
            paramNames,
            handler
        });
    }

    // Match and handle route
    async handle(req, res) {
        if (req.method !== 'GET') return false;
        
        const urlPath = req.url.split('?')[0];
        
        for (const route of this.routes.keys()) {
            const match = urlPath.match(route.pattern);
            if (match) {
                // Extract parameters
                const params = {};
                route.paramNames.forEach((name, index) => {
                    params[name] = match[index + 1];
                });
                
                await route.handler(req, res, params);
                return true;
            }
        }
        return false; // No route found
    }
}

function renderParams(content,params){
    for (let key in params){
        content = content.replaceAll(`[${key}]`,params[key]);
    }
    return content;
}

const server = createServer(async (req, res) => {
    try {
        // Try router first (only for GET)
        const routeHandled = await router.handle(req, res);
        if (routeHandled) return;

        // Fallback to static file serving
        let filePath = decodeURIComponent(req.url.split('?')[0]);
        
        if(filePath.startsWith("/assets")){
            let ext = path.extname(filePath);
            try {
                const content = await fs.promises.readFile(assetsDir + filePath.replace('/assets', ''), 'utf-8');
                const mimeType = mimeTypes[ext] || 'application/octet-stream';
                res.writeHead(200, {
                    'content-Type': mimeType,
                    'content-Length': Buffer.byteLength(content)
                });
                res.end(content);
                return;
            } catch (error) {
                const content = await fs.promises.readFile(pagesDir + '/404.html', 'utf-8');
                res.writeHead(404, {
                    'content-Type': 'text/html',
                    'content-Length': Buffer.byteLength(content)
                });
                res.end(content);
            }
        }
        
        const content = await fs.promises.readFile(pagesDir + '/404.html', 'utf-8');
        res.writeHead(404, {
            'content-Type': 'text/html',
            'content-Length': Buffer.byteLength(content)
        });
        res.end(content);

    } catch (error) {
        if (error.code === 'ENOENT') {
            const content = await fs.promises.readFile(pagesDir + '/404.html', 'utf-8');
            res.writeHead(404, {
                'content-Type': 'text/html',
                'content-Length': Buffer.byteLength(content)
            });
            res.end(content);
        } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
            console.error('Server error:', error);
        }
    }
});

const router = new Router();
//@Routes

//@ServerFunctions

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});