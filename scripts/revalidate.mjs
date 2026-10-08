// Перерисовать статические карточки на работающем сервере (ISR, server/index.js) без сборки.
//
//   pnpm revalidate /films/dune-2021 /books/dune-novel   — указанные карточки, до ответа
//   pnpm revalidate films/dune-2021                      — ведущий / можно не писать
//   pnpm revalidate --all                                — вся статика, в фоне на сервере
//
// ISR_SECRET — токен сервера (обязателен), ISR_URL — сервер (http://127.0.0.1:3000).
// После изменений в коде нужна полная сборка (pnpm build): HTML ссылается на чанки сборки.
import process from 'node:process';

const isrUrl = process.env.ISR_URL ?? 'http://127.0.0.1:3000';
const secret = process.env.ISR_SECRET;
/** Максимум сервера за запрос. */
const BATCH = 100;

const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (!secret) fail('ISR_SECRET не задан');
if (!args.length) fail('укажите адреса карточек (/films/dune-2021) или --all');

if (args.includes('--all')) {
	const { started } = await post({ all: true });
	console.log(
		started
			? 'Пересборка всей статики запущена в фоне — ход и итог в логе сервера.'
			: 'Пересборка всей статики уже идёт — ход и итог в логе сервера.'
	);
	process.exit(0);
}

let ok = 0;
/** @type {{ path: string, status: number, error?: string }[]} */
const failed = [];
const paths = args.map((arg) => '/' + arg.replace(/^\/+|\/+$/g, ''));
for (let i = 0; i < paths.length; i += BATCH) {
	const { results } = await post({ paths: paths.slice(i, i + BATCH) });
	for (const result of results) {
		if (result.skipped) console.log(`– ${result.path} — не статическая страница, пропущена`);
		else if (result.status === 200) {
			ok++;
			console.log(`✓ ${result.path}`);
		} else failed.push(result);
	}
}

for (const { path, status, error } of failed)
	console.error(`✗ ${path} — ${status}${error ? `: ${error}` : ''}`);
console.log(`Готово: обновлено ${ok}, не обновлено ${failed.length}`);
process.exit(failed.length ? 1 : 0);

/** @param {unknown} body */
async function post(body) {
	let response;
	try {
		response = await fetch(`${isrUrl}/_isr/revalidate`, {
			method: 'POST',
			headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch (error) {
		fail(
			`сервер ${isrUrl} недоступен: ${error instanceof Error ? (error.cause ?? error.message) : error}`
		);
	}
	const json = await response.json().catch(() => ({}));
	// 502 — часть карточек не нарисовалась, results всё равно есть; остальное без них — ошибка
	// запроса целиком (неверный токен, тело).
	if (!response.ok && !json.results) fail(`${response.status}: ${JSON.stringify(json)}`);
	return json;
}

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`revalidate: ${message}`);
	process.exit(1);
}
