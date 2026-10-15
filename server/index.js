// Продовый сервер: сборка adapter-node + ISR статических страниц (карточки, студии). Запуск:
// `node server/index.js` после `pnpm build`. nginx отдаёт их с диска сам, сюда они приходят,
// только если файла нет (новое произведение или студия, удалённое, чужой раздел в адресе). Без
// nginx готовый файл с диска отдаёт этот сервер — тоже без бэкенда.
//
//   PORT, HOST     где слушать (127.0.0.1:3000)
//   ORIGIN         публичный адрес сайта, если не задан при сборке (https://nexus.example)
//   ISR_SECRET     токен для POST /_isr/revalidate
//   BACKEND_URL    API для списка каталога при {"all": true} (http://localhost)
//   ISR_CONCURRENCY  сколько страниц рисовать одновременно при {"all": true} (8)
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { handler } from '../build/handler.js';
import { base, dir, origin as builtOrigin, server } from '../build/adapter-node.js';
import { STATIC_PAGE, createIsr } from './isr.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const origin = builtOrigin || process.env.ORIGIN;
const secret = process.env.ISR_SECRET ?? '';
if (!origin) throw new Error('ORIGIN не задан: он нужен для og:url в статических страницах');
if (!secret) throw new Error('ISR_SECRET не задан');

const root = `${dir}/prerendered${base}`;
// handler.js при импорте уже выполнил server.init — перерисовка идёт тем же экземпляром.
const isr = createIsr({
	server,
	root,
	origin,
	backend: process.env.BACKEND_URL || 'http://localhost'
});

/** Не больше 100 адресов за запрос (бэкенд шлёт пачками по 100); на всё сразу — {"all": true}. */
const MAX_PATHS = 100;

const httpServer = http.createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://internal');

	if (url.pathname === '/_isr/revalidate') return revalidate(req, res);

	// Статику не отдаём из build/prerendered через handler: его таблица файлов (размеры, etag)
	// снята при сборке и после перерисовки врёт. Файл на диске есть — отдаём его (x-isr: hit, без
	// бэкенда); нет — рисуем, сохраняем и отдаём свежий (x-isr: miss).
	const page = STATIC_PAGE.exec(url.pathname);
	if (page && (req.method === 'GET' || req.method === 'HEAD')) {
		const isData = Boolean(page[2]);
		/** @param {string | Buffer} body @param {'hit' | 'miss'} cache */
		const send = (body, cache) => {
			res.writeHead(200, {
				'content-type': isData ? 'application/json' : 'text/html; charset=utf-8',
				'cache-control': 'public, max-age=0, must-revalidate',
				'x-isr': cache
			});
			res.end(req.method === 'HEAD' ? undefined : body);
		};
		const file = join(root, isData ? `${page[1]}/__data.json` : `${page[1]}.html`);
		const saved = await readFile(file).catch(() => null);
		if (saved) return send(saved, 'hit');
		try {
			const result = await isr.regenerate(page[1]);
			if (result.status === 200) return send((isData ? result.data : result.html) ?? '', 'miss');
		} catch (error) {
			console.error(`ISR ${page[1]}:`, error);
		}
		// 404, редирект, ошибка — обычный SSR с настоящим ответом и заголовками.
	}

	handler(req, res, () => {
		res.statusCode = 404;
		res.end();
	});
});

/**
 * POST /_isr/revalidate, Authorization: Bearer <ISR_SECRET>. Бэкенд ждёт ответ не дольше 30 с и
 * считает успехом любой 2xx (libs/shared/src/isr.rs в nexus_project).
 *
 *   {"paths": ["/films/dune-2021", "/studios/mosfilm", "/people/denis-villeneuve"]}
 *   → 200 {"results": [{"path": "/films/dune-2021", "status": 200},
 *                      {"path": "/studios/mosfilm", "status": 200},
 *                      {"path": "/people/denis-villeneuve", "skipped": true}]}
 *   Карточки и студии перерисовываются до ответа; адреса без статики (люди, разделы) пропускаются.
 *   502 — какая-то страница не нарисовалась (бэкенд лежит): старые файлы на месте, можно повторить.
 *
 *   {"all": true} → 202 {"started": true}: вся статика пересобирается в фоне (ход — в логе
 *   сервера). Уже идёт — 202 {"started": false}.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function revalidate(req, res) {
	/** @param {number} status @param {unknown} body */
	const reply = (status, body) =>
		res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
	const usage = 'body: {"paths": ["/films/slug", …]} или {"all": true}';

	if (req.method !== 'POST') return reply(405, { error: 'POST only' });
	if (!authorized(req.headers.authorization)) return reply(401, { error: 'unauthorized' });

	/** @type {{ paths?: unknown, all?: unknown }} */
	let body;
	try {
		body = JSON.parse(await readBody(req)) ?? {};
	} catch {
		return reply(400, { error: usage });
	}

	if (body.all === true) return reply(202, { started: isr.regenerateAll() });

	const { paths } = body;
	if (!Array.isArray(paths) || !paths.length || paths.length > MAX_PATHS) {
		return reply(400, { error: `${usage}; paths — 1–${MAX_PATHS} адресов` });
	}
	if (!paths.every((path) => typeof path === 'string' && path.startsWith('/'))) {
		return reply(400, { error: 'paths: адреса страниц, начинаются с /' });
	}

	const results = await Promise.all(
		/** @type {string[]} */ (paths).map((path) => {
			const page = STATIC_PAGE.exec(path)?.[1];
			if (!page) return { path, skipped: true };
			return isr.regenerate(page).then(
				({ status }) => ({ path, status }),
				(error) => ({ path, status: 500, error: String(error) })
			);
		})
	);
	const failed = results.some((r) => 'status' in r && r.status >= 500);
	reply(failed ? 502 : 200, { results });
}

/** @param {string | undefined} header */
function authorized(header) {
	const given = Buffer.from(header ?? '');
	const expected = Buffer.from(`Bearer ${secret}`);
	return given.length === expected.length && timingSafeEqual(given, expected);
}

/** @param {http.IncomingMessage} req */
async function readBody(req) {
	let body = '';
	for await (const chunk of req) {
		body += chunk;
		if (body.length > 64 * 1024) throw new Error('too large');
	}
	return body;
}

httpServer.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		httpServer.closeIdleConnections();
		httpServer.close(() => process.exit(0));
		setTimeout(() => process.exit(0), 10_000).unref();
	});
}
