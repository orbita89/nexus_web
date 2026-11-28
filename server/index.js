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
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { handler } from '../build/handler.js';
import { base, dir, origin as builtOrigin, server } from '../build/adapter-node.js';
import { promisify } from 'node:util';
import { brotliDecompress } from 'node:zlib';
import { acceptsBrotli, brOnly, createIsr, staticFiles, staticPage } from './isr.js';

const unbr = promisify(brotliDecompress);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const origin = builtOrigin || process.env.ORIGIN;
const secret = process.env.ISR_SECRET ?? '';
if (!origin) throw new Error('ORIGIN не задан: он нужен для og:url в статических страницах');
if (!secret) throw new Error('ISR_SECRET не задан');

const root = `${dir}/prerendered${base}`;
/** API: список каталога для {"all": true} и пересылка /api, /ws (proxyApi). */
const backendUrl = new URL(process.env.BACKEND_URL || 'http://localhost');
// handler.js при импорте уже выполнил server.init — перерисовка идёт тем же экземпляром.
const isr = createIsr({
	server,
	root,
	origin,
	backend: backendUrl.origin
});

/**
 * Кэш статических страниц в браузере: 5 минут открывает их повторно без запроса; правка карточки видна у того, кто её недавно открывал, не позже чем через
 * 5 минут. Дальше — переспрос с ETag и 304. Так же в deploy/nginx.conf.
 */
const STATIC_CACHE = 'public, max-age=300';

/** Не больше 100 адресов за запрос (бэкенд шлёт пачками по 100); на всё сразу — {"all": true}. */
const MAX_PATHS = 100;

/**
 * Главная собрана из каталога, подборок, каналов и оценок — они меняются без правки карточки
 * (активность каналов, подборки редакции), поэтому её перерисовываем по таймеру, а не только по
 * сигналу бэкенда. Один рендер раз в HOME_REFRESH_SEC (по умолчанию 10 минут) вместо ~20
 * запросов к API на каждого посетителя. 0 — выключено.
 */
const HOME_REFRESH_SEC = Number(process.env.ISR_HOME_REFRESH_SEC ?? 600);
if (HOME_REFRESH_SEC > 0) {
	const tick = () =>
		isr.regenerate('/').catch((error) => console.error('ISR /:', error));
	setInterval(tick, HOME_REFRESH_SEC * 1000).unref();
}

const httpServer = http.createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://internal');

	if (url.pathname === '/_isr/revalidate') return revalidate(req, res);
	if (url.pathname === '/_isr/status') return isrStatus(req, res);
	if (url.pathname.startsWith('/api/')) return proxyApi(req, res);

	// Статику не отдаём из build/prerendered через handler: его таблица файлов (размеры, etag)
	// снята при сборке и после перерисовки врёт. Файл на диске есть — отдаём его (x-isr: hit, без
	// бэкенда) с ETag, как nginx: 5 минут браузер берёт её из своего кэша, потом переспрашивает и
	// получает 304 без тела; нет файла — рисуем, сохраняем и отдаём свежий (x-isr: miss).
	const page = staticPage(url.pathname);
	if (page && (req.method === 'GET' || req.method === 'HEAD')) {
		const isData = Boolean(page[2]);
		/**
		 * @param {string | Buffer} body
		 * @param {'hit' | 'miss'} cache
		 * @param {string} [etag]
		 * @param {boolean} [encoded] body — уже brotli (Content-Encoding: br)
		 */
		const send = (body, cache, etag, encoded = false) => {
			res.writeHead(200, {
				'content-type': isData ? 'application/json' : 'text/html; charset=utf-8',
				'cache-control': STATIC_CACHE,
				'x-isr': cache,
				...(etag && { etag }),
				...(onlyBr && { vary: 'Accept-Encoding' }),
				...(encoded && { 'content-encoding': 'br' })
			});
			res.end(req.method === 'HEAD' ? undefined : body);
		};
		const files = staticFiles(page[1]);
		// Книги лежат только сжатыми (.br, brOnly в isr.js): браузеру с brotli — как есть, остальным
		// (старые браузеры, превью ссылок, curl) — распакованные. Всё с диска, без API.
		const onlyBr = brOnly(page[1]);
		const plain = join(root, isData ? files.data : files.html);
		const file = onlyBr ? `${plain}.br` : plain;
		const info = await stat(file).catch(() => null);
		if (info) {
			// Как у nginx: время изменения и размер. ISR заменяет файл через rename — ETag меняется.
			const etag = `"${Math.floor(info.mtimeMs / 1000).toString(16)}-${info.size.toString(16)}"`;
			if (req.headers['if-none-match'] === etag) {
				res.writeHead(304, { etag, 'cache-control': STATIC_CACHE });
				return res.end();
			}
			const saved = await readFile(file).catch(() => null);
			if (saved && !onlyBr) return send(saved, 'hit', etag);
			if (saved && acceptsBrotli(req.headers['accept-encoding']))
				return send(saved, 'hit', etag, true);
			if (saved) {
				const unpacked = await unbr(saved).catch(() => null);
				if (unpacked) return send(unpacked, 'hit', etag);
			}
		}
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
 * /api/… — на бэкенд (BACKEND_URL). На проде и в деве через nginx сюда /api не доходит: nginx
 * отправляет его на бэкенд сам. Пересылка — чтобы сайт, открытый напрямую на :3000, не показывал
 * «Не найдено» во всём, что браузер грузит из API.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function proxyApi(req, res) {
	const target = new URL(req.url ?? '/', backendUrl);
	const client = target.protocol === 'https:' ? https : http;
	const upstream = client.request(
		target,
		{
			method: req.method,
			headers: {
				...req.headers,
				host: target.host,
				'x-forwarded-host': req.headers.host ?? '',
				'x-forwarded-for': req.socket.remoteAddress ?? ''
			}
		},
		(response) => {
			res.writeHead(response.statusCode ?? 502, response.headers);
			response.pipe(res);
		}
	);
	upstream.on('error', (error) => {
		console.error(`API ${target.pathname}:`, error.message);
		if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: 'backend unavailable' }));
	});
	req.pipe(upstream);
}

/**
 * WebSocket /ws — на бэкенд, сырым TCP-туннелем: повторяем запрос апгрейда и дальше просто
 * связываем сокеты. Как proxyApi — только для захода мимо nginx.
 * @param {http.IncomingMessage} req
 * @param {import('node:stream').Duplex} socket
 * @param {Buffer} head
 */
function proxyWs(req, socket, head) {
	const secure = backendUrl.protocol === 'https:';
	const port = Number(backendUrl.port || (secure ? 443 : 80));
	const upstream = secure
		? tls.connect(port, backendUrl.hostname, { servername: backendUrl.hostname })
		: net.connect(port, backendUrl.hostname);
	upstream.on(secure ? 'secureConnect' : 'connect', () => {
		const headers = { ...req.headers, host: backendUrl.host };
		const lines = Object.entries(headers).flatMap(([k, v]) =>
			(Array.isArray(v) ? v : [v]).map((value) => `${k}: ${value}`)
		);
		upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join('\r\n')}\r\n\r\n`);
		if (head.length) upstream.write(head);
		upstream.pipe(socket);
		socket.pipe(upstream);
	});
	const close = () => {
		upstream.destroy();
		socket.destroy();
	};
	upstream.on('error', close);
	socket.on('error', close);
}

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
 *   сервера и в GET /_isr/status). {"all": true, "kind": "book"} — только этот раздел.
 *   Уже идёт — 202 {"started": false}.
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

	/** @type {{ paths?: unknown, all?: unknown, kind?: unknown }} */
	let body;
	try {
		body = JSON.parse(await readBody(req)) ?? {};
	} catch {
		return reply(400, { error: usage });
	}

	if (body.all === true) {
		const kind = typeof body.kind === 'string' ? body.kind : null;
		try {
			return reply(202, { started: isr.regenerateAll(kind) });
		} catch {
			return reply(400, { error: 'kind: movie, series, book, game, painting' });
		}
	}

	const { paths } = body;
	if (!Array.isArray(paths) || !paths.length || paths.length > MAX_PATHS) {
		return reply(400, { error: `${usage}; paths — 1–${MAX_PATHS} адресов` });
	}
	if (!paths.every((path) => typeof path === 'string' && path.startsWith('/'))) {
		return reply(400, { error: 'paths: адреса страниц, начинаются с /' });
	}

	const results = await Promise.all(
		/** @type {string[]} */ (paths).map((path) => {
			const page = staticPage(path)?.[1];
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

/**
 * GET /_isr/status, Authorization: Bearer <ISR_SECRET> — ход последней пересборки
 * ({"all": true}): 200 {"run": {kind, total, done, changed, failed, started_at, finished_at,
 * error, running} | null}. Его читает бэкенд для админки.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function isrStatus(req, res) {
	/** @param {number} status @param {unknown} body */
	const reply = (status, body) =>
		res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
	if (req.method !== 'GET') return reply(405, { error: 'GET only' });
	if (!authorized(req.headers.authorization)) return reply(401, { error: 'unauthorized' });
	reply(200, { run: isr.status() });
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

httpServer.on('upgrade', (req, socket, head) => {
	if ((req.url ?? '').startsWith('/ws')) return proxyWs(req, socket, head);
	socket.destroy();
});

// Порт занят — почти всегда это старый сервер прошлой сборки: он отдаёт HTML со ссылками на
// стёртые чанки, и сайт теряет стили. Падаем громко, а не молча.
httpServer.on('error', (error) => {
	if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EADDRINUSE') {
		console.error(
			`\nПорт ${port} уже занят — скорее всего, старым сервером прошлой сборки.\n` +
				`Остановите его и запустите снова:\n  ss -ltnp | grep :${port}\n  kill <pid>\n`
		);
		process.exit(1);
	}
	throw error;
});

httpServer.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
	// Напрямую (:port) сайт тоже работает — /api и /ws пересылаются на бэкенд, — но статику с диска
	// без Node и сжатие отдаёт только nginx: проверять «как на проде» — через него.
	console.log(`Сайт как на проде (через nginx): ${origin}; API: ${backendUrl.origin}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		httpServer.closeIdleConnections();
		httpServer.close(() => process.exit(0));
		setTimeout(() => process.exit(0), 10_000).unref();
	});
}
