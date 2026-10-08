// ISR карточек: перерисовать одну страницу сборкой SvelteKit и атомарно положить HTML и
// __data.json (и их .br/.gz) туда, откуда их отдаёт nginx. Полная сборка для этого не нужна.
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const br = promisify(brotliCompress);
const gz = promisify(gzip);

/**
 * Карточка и её данные: /films/dune-2021, /films/dune-2021/__data.json. slug — как на бэкенде:
 * латиница, цифры, дефисы; заодно в путь файла не попадут `..` и `%2e`.
 */
export const CARD = /^(\/(?:films|series|books|games)\/[a-z0-9]+(?:-[a-z0-9]+)*)(\/__data\.json)?$/;

/** Раздел в адресе по типу сущности — как KINDS в src/lib/catalog/kinds.ts. */
const SECTION = { movie: 'films', series: 'series', book: 'books', game: 'games' };
/** Сколько карточек рисовать одновременно при пересборке всего: не забить CPU и бэкенд. */
const ALL_CONCURRENCY = Number(process.env.ISR_CONCURRENCY ?? 8);

/**
 * @param {{
 *   server: import('@sveltejs/kit').Server,
 *   root: string,
 *   origin: string,
 *   backend: string
 * }} options root — каталог пререндера (build/prerendered), origin — публичный адрес сайта,
 *   backend — API для списка каталога (BACKEND_URL)
 */
export function createIsr({ server, root, origin, backend }) {
	/** Перерисовки в работе: промах и сигнал бэкенда на одну карточку — одна перерисовка. */
	const running = new Map();

	/** @param {string} pathname */
	const render = (pathname) =>
		server.respond(new Request(new URL(pathname, origin)), {
			// Рендер как для гостя: без cookie и токена, адрес — локальный.
			getClientAddress: () => '127.0.0.1',
			platform: {}
		});

	/**
	 * Перерисовать карточку. 200 — файлы заменены; 404 и редиректы (удалили, сменили раздел) —
	 * файлы удалены, адрес обслуживает сервер; 5xx (бэкенд лежит) — старые файлы остаются.
	 * @param {string} path адрес карточки без __data.json
	 * @returns {Promise<{ path: string, status: number, html?: string, data?: string }>}
	 */
	function regenerate(path) {
		let job = running.get(path);
		if (!job) {
			job = regenerateNow(path).finally(() => running.delete(path));
			running.set(path, job);
		}
		return job;
	}

	/** @param {string} path */
	async function regenerateNow(path) {
		const files = [join(root, `${path}.html`), join(root, path, '__data.json')];
		// Сначала страница: несуществующий slug не стоит второго рендера.
		const page = await render(path);
		const html = await page.text();
		if (page.status >= 300 && page.status < 500) {
			await Promise.all(files.flatMap((file) => [file, `${file}.br`, `${file}.gz`].map(remove)));
		}
		if (page.status !== 200) return { path, status: page.status };

		const data = await render(`${path}/__data.json`);
		const json = await data.text();
		if (data.status !== 200) return { path, status: data.status };

		await Promise.all([publish(files[0], html), publish(files[1], json)]);
		return { path, status: 200, html, data: json };
	}

	/** @type {Promise<void> | null} */
	let all = null;

	/**
	 * Пересобрать всю статику в фоне: весь каталог из API и всё, что уже лежит на диске (удалённые
	 * с тех пор сущности так уходят из статики). Уже идёт — false, второй не запускается.
	 */
	function regenerateAll() {
		if (all) return false;
		all = regenerateAllNow()
			.catch((error) => console.error('ISR all: прервано', error))
			.finally(() => (all = null));
		return true;
	}

	async function regenerateAllNow() {
		const started = Date.now();
		const paths = new Set([...(await cataloguePaths()), ...(await diskPaths())]);
		console.log(`ISR all: ${paths.size} карточек`);

		const queue = [...paths];
		let done = 0;
		/** @type {{ path: string, status: number }[]} */
		const failed = [];
		const worker = async () => {
			for (let path = queue.shift(); path; path = queue.shift()) {
				const result = await regenerate(path).catch(() => ({ path, status: 500 }));
				if (result.status >= 500) failed.push({ path, status: result.status });
				if (++done % 1000 === 0) console.log(`ISR all: ${done} из ${paths.size}`);
			}
		};
		await Promise.all(Array.from({ length: ALL_CONCURRENCY }, worker));

		const seconds = Math.round((Date.now() - started) / 1000);
		console.log(`ISR all: готово за ${seconds} с, ошибок ${failed.length}`);
		for (const { path, status } of failed.slice(0, 20))
			console.error(`ISR all: ${path} — ${status}`);
	}

	/** Адреса всех карточек каталога (offset-страницы API по 100). */
	async function cataloguePaths() {
		const paths = [];
		for (let offset = 0, total = Infinity; offset < total; offset += 100) {
			const response = await fetch(`${backend}/api/v1/catalog/entities?limit=100&offset=${offset}`);
			if (!response.ok) throw new Error(`каталог: ${response.status}`);
			const page = await response.json();
			total = page.total;
			if (!page.items.length) break;
			for (const e of page.items) paths.push(`/${SECTION[e.kind]}/${e.slug}`);
		}
		return paths;
	}

	/** Адреса карточек, у которых есть HTML на диске. */
	async function diskPaths() {
		const paths = [];
		for (const section of Object.values(SECTION)) {
			const files = await readdir(join(root, section)).catch(() => []);
			for (const file of files) {
				const path = `/${section}/${file.slice(0, -'.html'.length)}`;
				if (file.endsWith('.html') && CARD.test(path)) paths.push(path);
			}
		}
		return paths;
	}

	return { regenerate, regenerateAll };
}

/**
 * Записать файл и сжатые варианты: во временный файл рядом и rename — nginx никогда не
 * увидит недописанный файл. Сжатые пишутся первыми: иначе после замены HTML nginx какое-то
 * время отдавал бы по gzip_static старый .gz.
 * @param {string} file
 * @param {string} content
 */
async function publish(file, content) {
	await mkdir(dirname(file), { recursive: true });
	const body = Buffer.from(content);
	const [brotli, gzipped] = await Promise.all([
		br(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
		gz(body, { level: 9 })
	]);
	await Promise.all([atomicWrite(`${file}.br`, brotli), atomicWrite(`${file}.gz`, gzipped)]);
	await atomicWrite(file, body);
}

/**
 * @param {string} file
 * @param {Buffer} content
 */
async function atomicWrite(file, content) {
	const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
	await writeFile(tmp, content);
	await rename(tmp, file);
}

/** @param {string} file */
const remove = (file) => rm(file, { force: true });
