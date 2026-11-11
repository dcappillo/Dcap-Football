#!/usr/bin/env node
/**
 * Development server: builds an unminified bundle, serves dist/ on
 * http://localhost:5173, and rebuilds whenever a file in src/ changes.
 * Refresh the browser after saving to pick up changes.
 */
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { build } = require('./build');

const PORT = Number(process.env.PORT) || 5173;
const DIST = path.resolve(__dirname, '..', 'dist');
const SRC = path.resolve(__dirname, '..', 'src');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

let pending = null;
function rebuild() {
  clearTimeout(pending);
  pending = setTimeout(() => build({ dev: true }).catch((err) => console.error(err.message)), 100);
}

build({ dev: true }).then(() => {
  fs.watch(SRC, { recursive: true }, rebuild);

  http
    .createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    })
    .listen(PORT, () => console.log(`CapFootball running at http://localhost:${PORT}`));
});
