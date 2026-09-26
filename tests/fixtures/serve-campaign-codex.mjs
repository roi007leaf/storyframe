import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };
http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/icons/')) {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#35425d"/><circle cx="40" cy="28" r="15" fill="#a8b8d5"/><path d="M12 75a28 28 0 0 1 56 0" fill="#a8b8d5"/></svg>');
    return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname.replace(/^\/modules\/storyframe/, '')));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    const body = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain' }); response.end(body);
  } catch { response.writeHead(404).end(); }
}).listen(8765, '127.0.0.1', () => console.log('Fixture: http://127.0.0.1:8765/modules/storyframe/tests/fixtures/campaign-codex.html'));
