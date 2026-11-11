#!/usr/bin/env node
/**
 * Build script.
 *
 * The game is written as classic browser scripts that share one global scope
 * (inline onclick handlers in the markup call these functions by name), so the
 * build concatenates the source files in the order listed in src/load-order.json
 * rather than bundling ES modules. Several files wrap functions defined by
 * earlier files, which is why that order matters.
 *
 * Usage:
 *   node scripts/build.js            production build into dist/ (minified, hashed assets)
 *   node scripts/build.js --dev      unminified build, no hashes (used by the dev server)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

function readSource(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
}

function concatScripts(dev) {
  const order = JSON.parse(readSource('load-order.json'));
  const listed = new Set(order);
  const missing = order.filter((rel) => !fs.existsSync(path.join(SRC, rel)));
  if (missing.length) throw new Error(`load-order.json lists missing files:\n  ${missing.join('\n  ')}`);

  const unlisted = walk(path.join(SRC, 'js'))
    .map((abs) => path.relative(SRC, abs).split(path.sep).join('/'))
    .filter((rel) => !listed.has(rel));
  if (unlisted.length) throw new Error(`Add these files to src/load-order.json:\n  ${unlisted.join('\n  ')}`);

  return order.map((rel) => (dev ? `/* ---- ${rel} ---- */\n` : '') + readSource(rel).trimEnd() + '\n;').join('\n\n');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(abs) : entry.name.endsWith('.js') ? [abs] : [];
  });
}

async function minify(js, css) {
  const esbuild = require('esbuild');
  // No `format` is set, so esbuild treats the code as a classic script and keeps
  // top-level names intact; the markup depends on them.
  const [jsOut, cssOut] = await Promise.all([
    esbuild.transform(js, { minify: true, target: 'es2019', legalComments: 'none' }),
    esbuild.transform(css, { loader: 'css', minify: true }),
  ]);
  return { js: jsOut.code, css: cssOut.code };
}

async function build({ dev = false } = {}) {
  const started = Date.now();
  let js = concatScripts(dev);
  let css = readSource('styles/main.css');
  if (!dev) ({ js, css } = await minify(js, css));

  const jsName = dev ? 'app.js' : `app.${contentHash(js)}.js`;
  const cssName = dev ? 'app.css' : `app.${contentHash(css)}.css`;

  const html = readSource('index.html')
    .replace('href="styles/main.css"', `href="assets/${cssName}"`)
    .replace('<!-- @scripts -->', `<script src="assets/${jsName}"></script>`);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  fs.writeFileSync(path.join(DIST, 'assets', jsName), js);
  fs.writeFileSync(path.join(DIST, 'assets', cssName), css);
  fs.writeFileSync(path.join(DIST, '.nojekyll'), ''); // GitHub Pages: serve files as-is

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`Built ${dev ? 'dev' : 'production'} bundle in ${Date.now() - started} ms`);
  console.log(`  dist/assets/${jsName}  ${kb(Buffer.byteLength(js))}`);
  console.log(`  dist/assets/${cssName}  ${kb(Buffer.byteLength(css))}`);
}

module.exports = { build };

if (require.main === module) {
  build({ dev: process.argv.includes('--dev') }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
