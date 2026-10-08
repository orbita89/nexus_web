// Перерисовать статические карточки на работающем сервере (ISR, server/index.js) без сборки.
//
//   pnpm revalidate /films/dune-2021 /books/dune-novel   — указанные карточки
//   pnpm revalidate films/dune-2021                      — ведущий / можно не писать
//   pnpm revalidate --all                                — весь каталог, пачками по 100
//
// ISR_SECRET — токен сервера (обязателен), ISR_URL — сервер (http://127.0.0.1:3000),
// BACKEND_URL — откуда брать список для --all (http://localhost).
// После изменений в коде нужна полная сборка (pnpm build:static): HTML ссылается на чанки сборки.
import process from 'node:process';

const isrUrl = process.env.ISR_URL ?? 'http://127.0.0.1:3000';
const backend = process.env.BACKEND_URL || 'http://localhost';
const secret = process.env.ISR_SECRET;
/** Максимум сервера за запрос и максимум API за страницу. */
const BATCH = 100;
/** Раздел в адресе по типу сущности — как в src/lib/catalog/kinds.ts. */
const SECTION = { movie: 'films', series: 'series', book: 'books', game: 'games' };

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const all = args.includes('--all');
if (!secret) fail('ISR_SECRET не задан');
if (!args.length) fail('укажите адреса карточек (/films/dune-2021) или --all');

let ok = 0;
/** @type {{ path: string, status: number, error?: string }[]} */
const failed = [];

if (all) {
	for (let offset = 0, total = Infinity; offset < total; offset += BATCH) {
		const response = await fetch(
			`${backend}/api/v1/catalog/entities?limit=${BATCH}&offset=${offset}`
		);
		if (!response.ok) fail(`каталог: ${response.status} ${await response.text()}`);
		const page = await response.json();
		total = page.total;
		if (!page.items.length) break;
		await revalidate(page.items.map((e) => `/${SECTION[e.kind]}/${e.slug}`));
		console.log(`${Math.min(offset + page.items.length, total)} из ${total}`);
	}
} else {
	const paths = args.map((arg) => '/' + arg.replace(/^\/+|\/+$/g, ''));
	for (let i = 0; i < paths.length; i += BATCH) await revalidate(paths.slice(i, i + BATCH));
}

for (const { path, status, error } of failed)
	console.error(`✗ ${path} — ${status}${error ? `: ${error}` : ''}`);
console.log(`Готово: обновлено ${ok}, не обновлено ${failed.length}`);
process.exit(failed.length ? 1 : 0);

/** @param {string[]} paths */
async function revalidate(paths) {
	let response;
	try {
		response = await fetch(`${isrUrl}/_isr/revalidate`, {
			method: 'POST',
			headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
			body: JSON.stringify({ paths })
		});
	} catch (error) {
		fail(
			`сервер ${isrUrl} недоступен: ${error instanceof Error ? (error.cause ?? error.message) : error}`
		);
	}
	const body = await response.json().catch(() => ({}));
	// 400 и 401 — ошибка запроса целиком (не карточка, неверный токен): дальше смысла нет.
	if (!body.results) fail(`${response.status}: ${JSON.stringify(body)}`);
	for (const result of body.results) {
		if (result.status === 200) {
			ok++;
			// В --all — только прогресс по пачкам, иначе каждая карточка.
			if (!all) console.log(`✓ ${result.path}`);
		} else failed.push(result);
	}
}

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`revalidate: ${message}`);
	process.exit(1);
}
