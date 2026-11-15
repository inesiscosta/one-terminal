// Bundles the e2e test page with esbuild and serves it for Playwright.
import { build } from 'esbuild';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, 'fixture');
const port = Number(process.env.PORT ?? 4173);

await build({
  entryPoints: [path.join(root, 'app.tsx')],
  outfile: path.join(root, 'dist/app.js'),
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'warning',
});

const types = { '.html': 'text/html', '.js': 'text/javascript' };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`e2e page on http://localhost:${port}`));
