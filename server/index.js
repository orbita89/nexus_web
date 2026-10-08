// Продовый сервер: сборка adapter-node + ISR карточек. Запуск: `node server/index.js` после
// `pnpm build`. nginx отдаёт карточки с диска сам, сюда они приходят, только если файла
// нет (новое произведение, удалённое, чужой раздел в адресе).
//
//   PORT, HOST     где слушать (127.0.0.1:3000)
//   ORIGIN         публичный адрес сайта, если не задан при сборке (https://nexus.example)
//   ISR_SECRET     токен для POST /_isr/revalidate
//   BACKEND_URL    API для списка каталога при {"all": true} (http://localhost)
//   ISR_CONCURRENCY  сколько карточек рисовать одновременно при {"all": true} (8)
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { handler } from '../build/handler.js';
import { base, dir, origin as builtOrigin, server } from '../build/adapter-node.js';
import { CARD, createIsr } from './isr.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const origin = builtOrigin || process.env.ORIGIN;
const secret = process.env.ISR_SECRET ?? '';
if (!origin) throw new Error('ORIGIN не задан: он нужен для og:url в статических карточках');
if (!secret) throw new Error('ISR_SECRET не задан');

// handler.js при импорте уже выполнил server.init — перерисовка идёт тем же экземпляром.
const isr = createIsr({
	server,
	root: `${dir}/prerendered${base}`,
	origin,
	backend: process.env.BACKEND_URL || 'http://localhost'
});

/** Не больше 100 адресов за запрос (бэкенд шлёт пачками по 100); на всё сразу — {"all": true}. */
const MAX_PATHS = 100;

const httpServer = http.createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://internal');

	if (url.pathname === '/_isr/revalidate') return revalidate(req, res);

	// Карточку не отдаём из build/prerendered через handler: его таблица файлов (размеры, etag)
	// снята при сборке и после перерисовки врёт. Рисуем, сохраняем и отдаём свежую.
	const card = CARD.exec(url.pathname);
	if (card && (req.method === 'GET' || req.method === 'HEAD')) {
		try {
			const result = await isr.regenerate(card[1]);
			if (result.status === 200) {
				const isData = Boolean(card[2]);
				res.writeHead(200, {
					'content-type': isData ? 'application/json' : 'text/html; charset=utf-8',
					'cache-control': 'public, max-age=0, must-revalidate',
					'x-isr': 'miss'
				});
				return res.end(req.method === 'HEAD' ? undefined : isData ? result.data : result.html);
			}
		} catch (error) {
			console.error(`ISR ${card[1]}:`, error);
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
 *   {"paths": ["/films/dune-2021", "/people/denis-villeneuve"]}
 *   → 200 {"results": [{"path": "/films/dune-2021", "status": 200},
 *                      {"path": "/people/denis-villeneuve", "skipped": true}]}
 *   Карточки перерисовываются до ответа; адреса без статики (люди, разделы) пропускаются.
 *   502 — какая-то карточка не нарисовалась (бэкенд лежит): старые файлы на месте, можно повторить.
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
			const card = CARD.exec(path)?.[1];
			if (!card) return { path, skipped: true };
			return isr.regenerate(card).then(
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
