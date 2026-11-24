// serve.mjs — tiny zero-dependency static file server for local preview.
// Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8744;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
};

createServer(async (req, res) => {
  try {
    // tools/bake-walls.html saves what it bakes here: only wall pictures and their layout, into icons/Plot
    // and the renders to repaint (bake-walls.html?repaint=1), into the theme's repaint folder in MOSKE APP
    const rp = req.method === 'PUT' && /^\/__bake\/repaint\/(\d\d-[a-z-]+)\/([a-z0-9-]+\.(png|json))$/.exec(req.url);
    if (rp) {
      const dir = join(ROOT, '..', 'MOSKE APP', 'Characters', 'Photos', 'Robots', 'Robots', 'Base', 'themes', rp[1], 'repaint');
      await mkdir(dir, { recursive: true });
      const chunks = []; for await (const c of req) chunks.push(c);
      await writeFile(join(dir, rp[2]), Buffer.concat(chunks));
      res.writeHead(200).end('ok'); return;
    }
    if (req.method === 'PUT' && req.url.startsWith('/__bake/')) {
      const name = decodeURIComponent(req.url.slice(8));
      if (!/^walls-[a-z0-9-]+\.(webp|json)$/.test(name)) { res.writeHead(400).end('bad name'); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      await writeFile(join(ROOT, 'icons', 'Plot', name), Buffer.concat(chunks));
      res.writeHead(200).end('ok'); return;
    }
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => console.log(`TriQuest dev server → http://localhost:${PORT}`));
