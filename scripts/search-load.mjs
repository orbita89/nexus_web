#!/usr/bin/env node
// Нагрузочная проверка поиска: смесь запросов сайта (текст, фильтры, сортировки, глубокие
// страницы, люди) в CONCURRENCY потоков на SECONDS секунд. Печатает запросы в секунду,
// задержки p50/p95/p99 по видам запросов и ошибки.
//
//   node scripts/search-load.mjs                       # http://localhost, 8 потоков, 30 с
//   BASE=https://site CONCURRENCY=16 SECONDS=60 node scripts/search-load.mjs
//
// Часть запросов уникальна (случайные слова и страницы): кэш ответов не спасает, видна цена
// самого поиска.

const BASE = (process.env.BASE ?? 'http://localhost').replace(/\/$/, '') + '/api/v1/catalog';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);
const SECONDS = Number(process.env.SECONDS ?? 30);

const WORDS = [
	'мастер',
	'маст',
	'властелин',
	'матр',
	'гарри',
	'звёздные',
	'война',
	'любовь',
	'дом',
	'ночь',
	'брат',
	'король',
	'тёмный',
	'игра',
	'город',
	'кольца',
	'битва',
	'море',
	'остров',
	'сын',
	'shrek',
	'matrix',
	'star',
	'lord',
	'harry',
	'dune',
	'alien',
	'batman',
	'witcher',
	'portal'
];
const KINDS = ['movie', 'series', 'book', 'game', 'painting'];
const SORTS = [
	'recommended',
	'trending',
	'top_rated',
	'new',
	'soon',
	'popular',
	'rating',
	'awarded',
	'title'
];
const PEOPLE = ['leonardo-dicaprio', 'christopher-nolan', 'brad-pitt', 'tom-hanks', 'stephen-king'];
const ROLES = ['actor', 'director', 'author'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const page = () => pick([0, 0, 0, 24, 48, 240, 2400]);

/** Вид запроса и адрес. */
const SCENARIOS = [
	['text', () => `/search?q=${encodeURIComponent(pick(WORDS))}&limit=24`],
	['text-prefix', () => `/search?q=${encodeURIComponent(pick(WORDS).slice(0, 3))}&limit=6`],
	['text-kind', () => `/search?q=${encodeURIComponent(pick(WORDS))}&kind=${pick(KINDS)}&limit=24`],
	['list', () => `/search?kind=${pick(KINDS)}&sort=${pick(SORTS)}&limit=24&offset=${page()}`],
	[
		'filter',
		() =>
			`/search?kind=movie&country=${pick(['us', 'ru', 'fr', 'jp'])}&year_from=${1980 + Math.floor(Math.random() * 40)}&sort=${pick(SORTS)}&limit=24`
	],
	['person', () => `/search?person=${pick(PEOPLE)}&limit=24`],
	['person-role', () => `/search?person=${pick(PEOPLE)}&role=${pick(ROLES)}&limit=24`],
	[
		'studio',
		() =>
			`/search?studio=${encodeURIComponent(pick(['Warner Bros.', 'Pixar', 'Marvel Studios', 'Мосфильм']))}&limit=24`
	],
	['people', () => `/search/people?limit=24&offset=${page()}`],
	[
		'people-text',
		() =>
			`/search/people?q=${encodeURIComponent(pick(['брэ', 'том', 'кристофер', 'скар', 'лео']))}&limit=24`
	]
];

const stats = new Map();
let errors = 0;
const firstErrors = [];

async function worker(until) {
	while (Date.now() < until) {
		const [name, url] = pick(SCENARIOS);
		const path = url();
		const started = performance.now();
		try {
			const res = await fetch(BASE + path);
			await res.arrayBuffer();
			if (!res.ok) {
				errors++;
				if (firstErrors.length < 5) firstErrors.push(`${res.status} ${path}`);
				continue;
			}
		} catch (e) {
			errors++;
			if (firstErrors.length < 5) firstErrors.push(`${e.message} ${path}`);
			continue;
		}
		const ms = performance.now() - started;
		if (!stats.has(name)) stats.set(name, []);
		stats.get(name).push(ms);
	}
}

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

const until = Date.now() + SECONDS * 1000;
console.log(`${BASE}: ${CONCURRENCY} потоков, ${SECONDS} с`);
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(until)));

let total = 0;
const all = [];
console.log('\nзапрос          n      p50     p95     p99   (мс)');
for (const [name, list] of [...stats].sort()) {
	list.sort((a, b) => a - b);
	total += list.length;
	all.push(...list);
	console.log(
		`${name.padEnd(14)} ${String(list.length).padStart(5)} ${q(list, 0.5).toFixed(1).padStart(8)} ${q(list, 0.95).toFixed(1).padStart(7)} ${q(list, 0.99).toFixed(1).padStart(7)}`
	);
}
all.sort((a, b) => a - b);
console.log(
	`\nвсего ${total} за ${SECONDS} с — ${(total / SECONDS).toFixed(1)} запр/с; p50 ${q(all, 0.5).toFixed(1)} мс, p95 ${q(all, 0.95).toFixed(1)} мс, p99 ${q(all, 0.99).toFixed(1)} мс; ошибок ${errors}`
);
if (firstErrors.length) console.log('первые ошибки:\n  ' + firstErrors.join('\n  '));
process.exitCode = errors > 0 ? 1 : 0;
