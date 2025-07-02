import { createServer as createServer_/*--seed--*/ } from 'http';
import fs_/*--seed--*/ from 'fs';
import path_/*--seed--*/ from 'path';
import { fileURLToPath as fileURLToPath_/*--seed--*/ } from 'url';

const __filename_/*--seed--*/ = fileURLToPath_/*--seed--*/(import.meta.url);
const __dirname_/*--seed--*/ = path_/*--seed--*/.dirname(__filename_/*--seed--*/);
const assetsDir_/*--seed--*/ = path_/*--seed--*/.join(__dirname_/*--seed--*/,'assets');
const pagesDir_/*--seed--*/ = path_/*--seed--*/.join(__dirname_/*--seed--*/,'pages');
const PORT_/*--seed--*/ = 3000;

const mimeTypes_/*--seed--*/ = {
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

class Router_/*--seed--*/ {
    constructor() {
        this.routes = new Map();
    }

    // Only GET requests
    get(path, handler) {
        // Convert path pattern to regex and store parameter names
        const params = [];
        const regexPath = path.replace(/\[(.*?)\]/g, (_, name) => {
                params.push(name);
                return '([^/]+)';
            }).replace(/\//g, '\\/');
        
        this.routes.set({
            pattern: new RegExp(`^${regexPath}$`),
            params,
            handler
        });
    }

    // Match and handle route
    async handle(req, res) {
        if (req.method !== 'GET') return false;
        
        let urlPath = req.url.split('?')[0];
        if (urlPath.endsWith('/') && urlPath != "/") urlPath = urlPath.substring(0, urlPath.length - 1); // convert /route/ to /route

        if (urlPath.endsWith('.html')) {
            urlPath = urlPath.slice(0, -5); // convert /route.html to /route
        }
        
        for (const route of this.routes.keys()) {
            const match = urlPath.match(route.pattern);
            if (match) {
                // Extract parameters
                const params = {};
                route.params.forEach((name, index) => {
                    params[name] = match[index + 1];
                });
                
                await route.handler(req, res, params);
                return true;
            }
        }
        return false; // No route found
    }
}

function renderParams_/*--seed--*/(content,params){
    for (let key in params){
        content = content.replaceAll(`[${key}]`,params[key]);
    }
    return content;
}

function renderTemplates_/*--seed--*/(content,computed,placeholderID){
    return content.replace(`<!--@[${placeholderID}]-->`,computed);
}

const server_/*--seed--*/ = createServer_/*--seed--*/(async (req, res) => {
    try {
        // Try router first (only for GET)
        const routeHandled = await router_/*--seed--*/.handle(req, res);
        if (routeHandled) return;

        // Fallback to static file serving
        let filePath = decodeURIComponent(req.url.split('?')[0]);
        
        if(filePath.startsWith("/assets")){
            const ext = path_/*--seed--*/.extname(filePath);
            try {
                const content = await fs_/*--seed--*/.promises.readFile(assetsDir_/*--seed--*/ + filePath.replace('/assets', ''), 'utf-8');
                const mimeType = mimeTypes_/*--seed--*/[ext] || 'application/octet-stream';
                res.writeHead(200, {
                    'content-Type': mimeType,
                    'content-Length': Buffer.byteLength(content)
                });
                res.end(content);
                return;
            } catch (error) {
                const content = await fs_/*--seed--*/.promises.readFile(pagesDir_/*--seed--*/ + '/404.html', 'utf-8');
                res.writeHead(404, {
                    'content-Type': 'text/html',
                    'content-Length': Buffer.byteLength(content)
                });
                res.end(content);
                return;
            }
        }
        
        const content = await fs_/*--seed--*/.promises.readFile(pagesDir_/*--seed--*/ + '/404.html', 'utf-8');
        res.writeHead(404, {
            'content-Type': 'text/html',
            'content-Length': Buffer.byteLength(content)
        });
        res.end(content);

    } catch (error) {
        if (error.code === 'ENOENT') {
            const content = await fs_/*--seed--*/.promises.readFile(pagesDir_/*--seed--*/ + '/404.html', 'utf-8');
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

const router_/*--seed--*/ = new Router_/*--seed--*/();
//@Routes

//@ServerFunctions

// Start server
server_/*--seed--*/.listen(PORT_/*--seed--*/, () => {
    console.log(`Server running at http://localhost:${PORT_/*--seed--*/}/`);
});