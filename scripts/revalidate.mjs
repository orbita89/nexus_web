// Перерисовать статические страницы (карточки, студии) на работающем сервере (ISR,
// server/index.js) без сборки.
//
//   pnpm revalidate /films/dune-2021 /studios/mosfilm    — указанные страницы, до ответа
//   pnpm revalidate films/dune-2021                      — ведущий / можно не писать
//   pnpm revalidate --all                                — вся статика, в фоне на сервере
//   pnpm revalidate --all --kind book                    — только раздел (book, movie, …)
//   pnpm revalidate --all --kind book --wait             — и дождаться конца: прогресс раз в 5 с,
//                                                           код выхода 1, если были ошибки
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
if (!args.length) fail('укажите адреса страниц (/films/dune-2021, /studios/mosfilm) или --all');

if (args.includes('--all')) {
	const kindAt = args.indexOf('--kind');
	const kind = kindAt >= 0 ? args[kindAt + 1] : undefined;
	if (kindAt >= 0 && !kind) fail('--kind: укажите раздел (book, movie, series, game, painting)');
	const { started } = await post(kind ? { all: true, kind } : { all: true });
	const what = kind ? `статики раздела ${kind}` : 'всей статики';
	if (!args.includes('--wait')) {
		console.log(
			started
				? `Пересборка ${what} запущена в фоне — ход и итог в логе сервера.`
				: `Пересборка ${what} уже идёт — ход и итог в логе сервера.`
		);
		process.exit(0);
	}
	if (!started) console.log(`Пересборка уже идёт — ждём её.`);
	process.exit(await waitRun());
}

/** Ждать конца пересборки (GET /_isr/status), печатая ход. Код выхода: 0 — без ошибок. */
async function waitRun() {
	const started = Date.now();
	for (;;) {
		await new Promise((resolve) => setTimeout(resolve, 5000));
		const response = await fetch(`${isrUrl}/_isr/status`, {
			headers: { authorization: `Bearer ${secret}` }
		}).catch((error) => fail(`${isrUrl}: ${error.message}`));
		if (!response.ok) fail(`${isrUrl}/_isr/status: ${response.status}`);
		const { run } = await response.json();
		if (!run) fail('сервер не знает о пересборке (перезапускался?)');
		const minutes = ((Date.now() - started) / 60000).toFixed(1);
		console.log(
			`${run.done} из ${run.total} · изменено ${run.changed} · ошибок ${run.failed.length} · ${minutes} мин`
		);
		if (run.running) continue;
		if (run.error) {
			console.error(`Прервано: ${run.error}`);
			return 1;
		}
		for (const { path, status } of run.failed) console.error(`✗ ${path} — ${status}`);
		console.log(
			`Готово: ${run.done} страниц, изменено ${run.changed}, ошибок ${run.failed.length}`
		);
		return run.failed.length ? 1 : 0;
	}
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
	// 502 — часть страниц не нарисовалась, results всё равно есть; остальное без них — ошибка
	// запроса целиком (неверный токен, тело).
	if (!response.ok && !json.results) fail(`${response.status}: ${JSON.stringify(json)}`);
	return json;
}

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`revalidate: ${message}`);
	process.exit(1);
}
