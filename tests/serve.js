// A local static server for the Playwright tests.
//
//   node tests/serve.js [--port 4173]     (or PORT=4173 node tests/serve.js)
//
// It serves the project root the way Vercel does, closely enough for the
// browser tests:
//
//   1. Files first. Vercel serves a file that exists before it looks at the
//      rewrites, so /style.css is the file and / is index.html.
//   2. cleanUrls (vercel.json): /404 serves 404.html, and /404.html redirects
//      to /404 with a 308, as Vercel does.
//   3. Then the rewrites in vercel.json, read from the file at start-up and
//      tried in order. A rewrite to a page (/index.html) serves that page.
//
// It never runs the API functions in api/. A request that ends up there (an
// /api/... path, or a rewrite such as /:slug -> /api/redirect/[slug]) gets a
// 404 JSON reply with an `x-serve-rewrite` header naming where Vercel would
// have sent it. The browser tests fake the API with page.route() before a
// request ever reaches this server.
//
// Dotfiles and dot-folders (other than .well-known) and node_modules are never
// served: the server refuses those paths before touching the disk.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const vercelConfig = JSON.parse(readFileSync(join(PROJECT_ROOT, 'vercel.json'), 'utf8'));

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
};

// Turns a vercel.json `source` into a regular expression. Handles the two
// forms the file uses: named segments (`/api/links/:id`) and raw regular
// expression groups (`/((?!api/).*)`). Named segments become named groups, so
// `:id` in a destination can be filled in from the match.
export function compileSource(source) {
    let pattern = '';
    let position = 0;
    while (position < source.length) {
        const character = source[position];
        const namedSegment = /^:([A-Za-z_][A-Za-z0-9_]*)/.exec(source.slice(position));
        if (character === ':' && namedSegment) {
            pattern += `(?<${namedSegment[1]}>[^/]+?)`;
            position += namedSegment[0].length;
            continue;
        }
        if (character === '(') {
            // Copy a balanced group through unchanged: it is already a regex.
            let depth = 0;
            let end = position;
            for (; end < source.length; end++) {
                if (source[end] === '\\') {
                    end++;
                    continue;
                }
                if (source[end] === '(') depth++;
                if (source[end] === ')') {
                    depth--;
                    if (depth === 0) break;
                }
            }
            pattern += source.slice(position, end + 1);
            position = end + 1;
            continue;
        }
        pattern += character.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
        position++;
    }
    return new RegExp(`^${pattern}$`);
}

const rewrites = (vercelConfig.rewrites || []).map((rewrite) => ({
    source: rewrite.source,
    destination: rewrite.destination,
    pattern: compileSource(rewrite.source),
}));

// The first rewrite whose source matches, with `:name` filled in, or null.
export function applyRewrites(pathname) {
    for (const rewrite of rewrites) {
        const match = rewrite.pattern.exec(pathname);
        if (!match) continue;
        const groups = match.groups || {};
        const destination = rewrite.destination.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (whole, name) => {
            if (name in groups) {
                return groups[name];
            }
            return whole;
        });
        return { source: rewrite.source, destination };
    }
    return null;
}

// True for paths the server refuses outright: dotfiles and dot-folders other
// than .well-known (so a .env is never read), and node_modules.
function isRefusedPath(pathname) {
    return pathname.split('/').some((segment) => {
        if (segment === 'node_modules') return true;
        return segment.startsWith('.') && segment !== '.well-known' && segment !== '';
    });
}

// The file on disk for a URL path, or null. Stays inside the project root.
async function findFile(pathname) {
    const candidates = [pathname];
    if (pathname.endsWith('/')) candidates.push(`${pathname}index.html`);
    else if (vercelConfig.cleanUrls) candidates.push(`${pathname}.html`, `${pathname}/index.html`);

    for (const candidate of candidates) {
        const filePath = normalize(join(PROJECT_ROOT, candidate));
        if (filePath !== PROJECT_ROOT && !filePath.startsWith(PROJECT_ROOT + sep)) continue;
        try {
            const info = await stat(filePath);
            if (info.isFile()) return filePath;
        } catch {
            // Not there: try the next candidate.
        }
    }
    return null;
}

async function sendFile(response, filePath, status = 200) {
    const body = await readFile(filePath);
    response.writeHead(status, {
        'content-type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
        'cache-control': 'no-store',
    });
    response.end(body);
}

function sendApiNotServed(response, destination) {
    response.writeHead(404, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-serve-rewrite': destination,
    });
    response.end(JSON.stringify({
        success: false,
        error: 'tests/serve.js does not run API functions; fake them with page.route()',
        destination,
    }));
}

async function handleRequest(request, response) {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
        response.writeHead(400).end();
        return;
    }

    if (isRefusedPath(pathname)) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
    }

    // The API is never served from disk: functions are not static files.
    const isApiPath = pathname === '/api' || pathname.startsWith('/api/');

    if (!isApiPath) {
        // cleanUrls: /page.html redirects to /page (and /index.html to /).
        if (vercelConfig.cleanUrls && pathname.endsWith('.html')) {
            let cleanPath = pathname.slice(0, -'.html'.length);
            if (cleanPath.endsWith('/index')) cleanPath = cleanPath.slice(0, -'index'.length);
            const query = new URL(request.url, 'http://localhost').search;
            response.writeHead(308, { location: cleanPath + query }).end();
            return;
        }

        let requestedPath = pathname;
        if (requestedPath === '/') {
            requestedPath = '/index.html';
        }
        const filePath = await findFile(requestedPath);
        if (filePath) {
            await sendFile(response, filePath);
            return;
        }
    }

    const rewrite = applyRewrites(pathname);
    let destination = pathname;
    if (rewrite) {
        destination = rewrite.destination;
    }
    if (destination === '/api' || destination.startsWith('/api/')) {
        sendApiNotServed(response, destination);
        return;
    }

    const rewrittenFile = await findFile(destination);
    if (rewrittenFile) {
        await sendFile(response, rewrittenFile);
        return;
    }

    // Vercel serves 404.html for anything left over.
    await sendFile(response, join(PROJECT_ROOT, '404.html'), 404);
}

function readPort() {
    const flagIndex = process.argv.indexOf('--port');
    if (flagIndex !== -1 && process.argv[flagIndex + 1]) return Number(process.argv[flagIndex + 1]);
    if (process.env.PORT) return Number(process.env.PORT);
    return 4173;
}

// Only start listening when run directly, so the routing helpers above can be
// imported on their own.
if (process.argv[1] && normalize(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = readPort();
    const server = createServer((request, response) => {
        handleRequest(request, response).catch((error) => {
            response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
            response.end(String(error));
        });
    });
    server.listen(port, '127.0.0.1', () => {
        console.log(`tests/serve.js: serving ${PROJECT_ROOT} at http://127.0.0.1:${port}`);
    });
}
