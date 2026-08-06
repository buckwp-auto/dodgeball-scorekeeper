import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(distDir, 'index.html');

if (!existsSync(indexHtml)) {
  console.error('postbuild-spa-fallback: dist/index.html not found');
  process.exit(1);
}

copyFileSync(indexHtml, path.join(distDir, '404.html'));
