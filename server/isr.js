// ISR статических страниц (карточки произведений и студии): перерисовать одну страницу сборкой
// SvelteKit и атомарно положить HTML и __data.json (и их .br/.gz) туда, откуда их отдаёт nginx.
// Полная сборка для этого не нужна.
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, brotliDecompress, constants, gzip } from 'node:zlib';
import { minify } from 'html-minifier-terser';

const br = promisify(brotliCompress);
const unbr = promisify(brotliDecompress);
const gz = promisify(gzip);

/**
 * Статическая страница и её данные: карточка (/films/dune-2021, /films/dune-2021/__data.json) или
 * студия (/studios/mosfilm). slug — как на бэкенде: латиница, цифры, дефисы; заодно в путь файла
 * не попадут `..` и `%2e`. Те же адреса — в location статики deploy/nginx.conf.
 */
export const STATIC_PAGE =
	/^(\/(?:films|series|books|games|paintings|studios)\/[a-z0-9]+(?:-[a-z0-9]+)*|\/awards\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/\d{4})?)(\/__data\.json)?$/;

/**
 * Файлы страницы на диске (без корня): HTML и данные. Адрес сайта не меняется — меняется только
 * раскладка: книги (их сотни тысяч) лежат по папкам из первых двух символов slug —
 * /books/belaya-gvardiya → books/be/belaya-gvardiya.html. Та же раскладка — в nginx (location книг).
 * @param {string} path адрес страницы без __data.json
 */
export function staticFiles(path) {
	const book = /^\/books\/([a-z0-9-]+)$/.exec(path);
	const base = book ? `/books/${book[1].slice(0, 2)}/${book[1]}` : path;
	return { html: `${base}.html`, data: `${base}/__data.json` };
}

/**
 * Адрес страницы по файлу HTML на диске (обратное staticFiles): книги — без папки шарда.
 * @param {string} file путь от корня статики: /books/be/belaya-gvardiya.html(.br)
 */
export function pathOfFile(file) {
	const path = file.replace(/\.html(\.br)?$/, '');
	const book = /^\/books\/[a-z0-9]{1,2}\/([a-z0-9-]+)$/.exec(path);
	return book ? `/books/${book[1]}` : path;
}

/**
 * Страница хранится только сжатой (`.br`): книги. Их сотни тысяч, а brotli понимают все
 * современные браузеры (~97%) — nginx отдаёт им `.br` как есть. Остальным (старые браузеры,
 * роботы превью, curl) `.br` распаковывает Node (server/index.js) — тоже с диска, без API.
 * Несжатого файла и `.gz` нет: место на диске в разы меньше, inode — вдвое.
 * @param {string} path адрес страницы
 */
export const brOnly = (path) => path.startsWith('/books/');

/**
 * Клиент принимает brotli: `br` в Accept-Encoding, и не с `q=0`.
 * @param {string | string[] | undefined} header
 */
export function acceptsBrotli(header) {
	return String(header ?? '')
		.split(',')
		.some((part) => {
			const [name, ...params] = part.split(';').map((s) => s.trim().toLowerCase());
			if (name !== 'br') return false;
			const q = params.find((p) => p.startsWith('q='));
			return !q || Number(q.slice(2)) > 0;
		});
}

/**
 * Элементы, где пробелы и переносы — часть текста (Tailwind `whitespace-pre-line` и т.п.:
 * абзацы описания книги). Минификатор их не трогает — иначе «Абзац 1.\n\nАбзац 2.» склеился бы.
 */
const KEEP_WHITESPACE =
	/<([a-z][a-z0-9]*)\b[^>]*\bwhitespace-(?:pre|pre-line|pre-wrap|break-spaces)\b[^>]*>[\s\S]*?<\/\1>/;

/**
 * Минификация HTML без риска для гидрации: комментарии Svelte (`<!--[-->`, `<!---->`) — метки,
 * по которым он оживляет страницу, их не трогаем; пробелы сжимаем до одного, но не убираем;
 * текст с значимыми переносами (KEEP_WHITESPACE, <pre>, <textarea>) — как есть.
 * @param {string} html
 */
export function minifyHtml(html) {
	return minify(html, {
		ignoreCustomFragments: [KEEP_WHITESPACE],
		collapseWhitespace: true,
		conservativeCollapse: true,
		removeComments: false,
		minifyCSS: false,
		minifyJS: false,
		keepClosingSlash: true
	});
}

/** Раздел в адресе по типу сущности — как KINDS в src/lib/catalog/kinds.ts. */
const SECTION = {
	movie: 'films',
	series: 'series',
	book: 'books',
	game: 'games',
	painting: 'paintings'
};
/**
 * Каталоги статики на диске: разделы карточек, студии и награды (списка студий в API нет — только
 * диск; у наград внутри премии ещё и годы, поэтому обход рекурсивный).
 */
const STATIC_DIRS = [...Object.values(SECTION), 'studios', 'awards'];
/** Сколько страниц рисовать одновременно при пересборке всего: не забить CPU и бэкенд. */
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
	/** Перерисовки в работе: промах и сигнал бэкенда на одну страницу — одна перерисовка. */
	const running = new Map();

	/** @param {string} pathname */
	const render = (pathname) =>
		server.respond(new Request(new URL(pathname, origin)), {
			// Рендер как для гостя: без cookie и токена, адрес — локальный.
			getClientAddress: () => '127.0.0.1',
			platform: {}
		});

	/**
	 * Перерисовать страницу. 200 — файлы заменены; 404 и редиректы (удалили, сменили раздел) —
	 * файлы удалены, адрес обслуживает сервер; 5xx (бэкенд лежит) — старые файлы остаются.
	 * @param {string} path адрес страницы без __data.json
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
		const rel = staticFiles(path);
		const files = [join(root, rel.html), join(root, rel.data)];
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

		const small = await minifyHtml(html);
		const publishAs = brOnly(path) ? publishBrotli : publish;
		const [a, b] = await Promise.all([publishAs(files[0], small), publishAs(files[1], json)]);
		return { path, status: 200, html: small, data: json, changed: a || b };
	}

	/** @type {Promise<void> | null} */
	let all = null;

	/**
	 * Ход последней пересборки — для админки (GET /_isr/status). Живёт в памяти процесса.
	 * @type {{ kind: string | null, total: number, done: number, changed: number,
	 *   failed: { path: string, status: number }[], started_at: string, finished_at: string | null,
	 *   error: string | null } | null}
	 */
	let progress = null;

	/**
	 * Пересобрать статику в фоне. Без kind — весь каталог из API и всё, что уже лежит на диске
	 * (удалённые с тех пор сущности так уходят из статики, студии перерисовываются); с kind
	 * (`book`, `movie`, …) — только этот раздел. Уже идёт — false, второй не запускается.
	 * @param {string | null} [kind]
	 */
	function regenerateAll(kind = null) {
		if (all) return false;
		if (kind && !(kind in SECTION)) throw new Error(`kind: ${kind}`);
		progress = {
			kind,
			total: 0,
			done: 0,
			changed: 0,
			failed: [],
			started_at: new Date().toISOString(),
			finished_at: null,
			error: null
		};
		const run = progress;
		all = regenerateAllNow(run)
			.catch((error) => {
				run.error = String(error);
				console.error('ISR all: прервано', error);
			})
			.finally(() => {
				run.finished_at = new Date().toISOString();
				all = null;
			});
		return true;
	}

	/** @param {NonNullable<typeof progress>} run */
	async function regenerateAllNow(run) {
		const started = Date.now();
		const section = run.kind ? /** @type {Record<string, string>} */ (SECTION)[run.kind] : null;
		const paths = new Set([
			...(await cataloguePaths(run.kind)),
			...(await diskPaths(section ? [section] : STATIC_DIRS))
		]);
		run.total = paths.size;
		console.log(`ISR all${run.kind ? ` (${run.kind})` : ''}: ${paths.size} страниц`);

		const queue = [...paths];
		const worker = async () => {
			for (let path = queue.shift(); path; path = queue.shift()) {
				/** @type {{ status: number, changed?: boolean }} */
				const result = await regenerate(path).catch(() => ({ path, status: 500 }));
				if (result.status >= 500) run.failed.push({ path, status: result.status });
				if (result.changed) run.changed++;
				if (++run.done % 1000 === 0) console.log(`ISR all: ${run.done} из ${paths.size}`);
			}
		};
		await Promise.all(Array.from({ length: ALL_CONCURRENCY }, worker));

		const seconds = Math.round((Date.now() - started) / 1000);
		console.log(
			`ISR all: готово за ${seconds} с, изменено ${run.changed}, ошибок ${run.failed.length}`
		);
		for (const { path, status } of run.failed.slice(0, 20))
			console.error(`ISR all: ${path} — ${status}`);
		// В статусе — первые 100 ошибок: тысячи строк админке не нужны.
		run.failed = run.failed.slice(0, 100);
	}

	/** Ход последней пересборки (или null, если её не было с запуска). */
	const status = () => progress && { ...progress, running: all !== null };

	/** Адреса всех карточек каталога (offset-страницы API по 100). */
	/** @param {string | null} kind */
	async function cataloguePaths(kind) {
		const paths = [];
		const only = kind ? `&kind=${kind}` : '';
		for (let offset = 0, total = Infinity; offset < total; offset += 100) {
			const response = await fetch(
				`${backend}/api/v1/catalog/entities?limit=100&offset=${offset}${only}`
			);
			if (!response.ok) throw new Error(`каталог: ${response.status}`);
			const page = await response.json();
			total = page.total;
			if (!page.items.length) break;
			for (const e of page.items) {
				// Фильтр и здесь: если API не знает kind, лишнего не перерисуем.
				if (!kind || e.kind === kind) paths.push(`/${SECTION[e.kind]}/${e.slug}`);
			}
		}
		return paths;
	}

	/** Адреса страниц (карточек, студий, премий и церемоний), у которых есть HTML на диске. */
	/** @param {readonly string[]} dirs */
	async function diskPaths(dirs) {
		const paths = [];
		for (const dir of dirs) {
			const files = await readdir(join(root, dir), { recursive: true, withFileTypes: true }).catch(
				() => []
			);
			for (const file of files) {
				if (!file.isFile() || !/\.html(\.br)?$/.test(file.name)) continue;
				// У страницы обычно и .html, и .html.br — адрес один раз (Set в regenerateAllNow).
				// parentPath — каталог файла: у церемонии это build/prerendered/awards/oscar.
				const inside = join(file.parentPath, file.name).slice(join(root, dir).length);
				const path = pathOfFile(`/${dir}${inside}`);
				if (STATIC_PAGE.test(path)) paths.push(path);
			}
		}
		return paths;
	}

	return { regenerate, regenerateAll, status };
}

/** Brotli на максимум: страницу сжимаем один раз, а отдаём тысячи раз. */
const brotli = (body) =>
	br(body, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: 11,
			[constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
			[constants.BROTLI_PARAM_SIZE_HINT]: body.length
		}
	});

/**
 * Записать файл и сжатые варианты (.br, .gz): во временный файл рядом и rename — nginx никогда
 * не увидит недописанный файл. Сжатые пишутся первыми: иначе после замены HTML nginx какое-то
 * время отдавал бы по gzip_static старый .gz. Содержимое не изменилось — ничего не трогаем:
 * время изменения и ETag остаются прежними, браузер и прокси получают 304, диск не пишется.
 * @param {string} file
 * @param {string} content
 * @returns {Promise<boolean>} файл изменился
 */
export async function publish(file, content) {
	const body = Buffer.from(content);
	const old = await readFile(file).catch(() => null);
	if (old && old.equals(body)) return false;
	await mkdir(dirname(file), { recursive: true });
	await Promise.all([
		brotli(body).then((b) => atomicWrite(`${file}.br`, b)),
		gz(body, { level: 9 }).then((g) => atomicWrite(`${file}.gz`, g))
	]);
	await atomicWrite(file, body);
	return true;
}

/**
 * Записать только сжатый `${file}.br` (книги, brOnly). Сравнение — с распакованным старым:
 * не изменилось — файл не трогаем. Старые несжатые варианты (раскладка до brOnly) удаляем.
 * @param {string} file путь несжатого файла; на диске будет `${file}.br`
 * @param {string} content
 * @returns {Promise<boolean>} файл изменился
 */
export async function publishBrotli(file, content) {
	const body = Buffer.from(content);
	const old = await readFile(`${file}.br`)
		.then((b) => unbr(b))
		.catch(() => null);
	if (old && old.equals(body)) return false;
	await mkdir(dirname(file), { recursive: true });
	await atomicWrite(`${file}.br`, await brotli(body));
	await Promise.all([remove(file), remove(`${file}.gz`)]);
	return true;
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
