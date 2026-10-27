import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
try { await stat(resolve(root, 'index.html')); } catch { console.error('Falta la compilación: ejecuta npm install y npm run build.'); process.exit(1); }
const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filename = resolve(root, '.' + pathname);
    const inside = relative(root, filename);
    if (inside.startsWith('..') || isAbsolute(inside)) { res.writeHead(403); return res.end('Forbidden'); }
    try { if ((await stat(filename)).isDirectory()) filename = resolve(filename, 'index.html'); } catch {
      if (extname(pathname)) { res.writeHead(404); return res.end('Not found'); }
      filename = resolve(root, 'index.html');
    }
    const data = await readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[extname(filename)] || 'application/octet-stream', 'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(400); res.end('Bad request'); }
});
server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Cierra la otra ventana de EcoAlert o cambia PORT.` : error.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}`;
  console.log(`EcoAlert VES: ${url}\nDeja esta ventana abierta. Ctrl+C para cerrar.`);
  if (process.argv.includes('--open')) {
    const command = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    const child = spawn(command[0], command[1], { stdio: 'ignore', detached: true });
    child.on('error', () => console.log(`Abre ${url} en tu navegador.`));
    child.unref();
  }
});
