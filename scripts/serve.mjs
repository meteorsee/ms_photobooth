import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const siteRoot = resolve('web');
const requestedPort = Number.parseInt(process.argv[2] ?? '8080', 10);

if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
  console.error('Port must be an integer between 1 and 65535.');
  process.exit(1);
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.otf': 'font/otf',
  '.svg': 'image/svg+xml',
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = resolve(siteRoot, relativePath);
  if (filePath !== siteRoot && !filePath.startsWith(`${siteRoot}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(requestedPort, '127.0.0.1', () => {
  console.log(`PhotoBooth preview: http://localhost:${requestedPort}/`);
  console.log('Press Ctrl+C to stop.');
});
