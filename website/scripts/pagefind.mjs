// Builds the Pagefind search index after `next build` and warns loudly if it's missing.
// Nextra's search loads `/_pagefind/pagefind.js`, so the index must ship inside `out/`.
import { execFileSync } from 'node:child_process';
import { existsSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const site = path.join(root, '.next/server/app');
const outIndex = path.join(root, 'out/_pagefind');
const publicIndex = path.join(root, 'public/_pagefind');

const warn = (msg) => console.warn(`\n\x1b[33m⚠ Pagefind: ${msg}\nSearch will not work in production.\x1b[0m\n`);

if (!existsSync(site)) {
  warn(`no built pages found at ${path.relative(root, site)}. Run \`next build\` first.`);
  process.exit(process.env.CI ? 1 : 0);
}

try {
  const bin = path.join(root, 'node_modules/pagefind/lib/runner/bin.cjs');
  execFileSync(process.execPath, [bin, '--site', site, '--output-path', outIndex], { stdio: 'inherit' });
} catch (err) {
  warn(`indexing failed (${err.message}).`);
}

if (!existsSync(path.join(outIndex, 'pagefind.js'))) {
  warn(`index missing at ${path.relative(root, outIndex)}.`);
  process.exit(process.env.CI ? 1 : 0);
}

// Mirror into public/ so `next dev` search works after a build.
rmSync(publicIndex, { recursive: true, force: true });
cpSync(outIndex, publicIndex, { recursive: true });
console.log('✓ Pagefind index written to out/_pagefind (and public/_pagefind for dev)');
