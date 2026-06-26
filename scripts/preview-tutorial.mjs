import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 5173;

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.json': 'application/json',
};

const server = createServer((req, res) => {
	let pathname = (req.url ?? '/').split('?')[0];
	if (pathname === '/') pathname = '/examples/tutorial-preview/index.html';

	const rel = pathname.replace(/^\/+/, '');
	const file = join(root, rel);

	if (!file.startsWith(root) || !existsSync(file)) {
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('Not found');
		return;
	}

	const ext = extname(file);
	res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
	res.end(readFileSync(file));
});

server.listen(port, () => {
	const url = `http://localhost:${port}/`;
	console.log(`Tutorial preview running at ${url}`);
	console.log('Press Ctrl+C to stop.');
});
