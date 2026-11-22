// Проверить, что сайт отдаёт страницы книг готовыми файлами (.br с диска), а не рисует их.
//
//   pnpm check-static https://nexus.example            — 20 случайных книг из build/prerendered
//   pnpm check-static https://nexus.example 200        — 200 книг
//   pnpm check-static http://localhost                 — дев (шлюз nexus_project)
//
// Для каждой книги два запроса: как браузер (Accept-Encoding: br) и как клиент без brotli.
// Браузер должен получить Content-Encoding: br от nginx (X-Static: nginx) или из кэша CDN;
// клиент без brotli — обычный HTML (из Node, x-isr: hit). x-isr: miss — страница нарисована
// сейчас (её не было на диске), это и есть «не из готовых файлов». Код выхода 1 — были такие.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const [base, countArg] = process.argv.slice(2).filter((arg) => arg !== '--');
if (!base) {
	console.error('укажите адрес сайта: pnpm check-static https://nexus.example [сколько]');
	process.exit(2);
}
const count = Number(countArg ?? 20);
const root = join(import.meta.dirname, '..', 'build', 'prerendered', 'books');

const slugs = await bookSlugs(root);
if (!slugs.length) {
	console.error(`в ${root} нет книг — сначала сгенерируйте статику`);
	process.exit(2);
}
const sample = slugs.sort(() => Math.random() - 0.5).slice(0, count);

/** Откуда пришёл ответ: заголовки nginx, Node и распространённых CDN. */
function source(headers) {
	if (headers.get('x-isr') === 'miss') return 'нарисована сейчас (не было файла)';
	if (headers.get('x-isr') === 'hit') return 'Node с диска';
	if (headers.get('x-static') === 'nginx') return 'nginx с диска';
	const cdn =
		headers.get('cf-cache-status') ?? headers.get('x-cache') ?? headers.get('x-cache-status');
	if (cdn) return `CDN (${cdn})`;
	return 'неизвестно';
}

let bad = 0;
for (const slug of sample) {
	const url = `${base.replace(/\/$/, '')}/books/${slug}`;
	const br = await fetch(url, { method: 'HEAD', headers: { 'accept-encoding': 'br' } });
	const plain = await fetch(url, { method: 'HEAD', headers: { 'accept-encoding': 'identity' } });
	const brOk = br.status === 200 && br.headers.get('content-encoding') === 'br';
	const plainOk = plain.status === 200 && !plain.headers.get('content-encoding');
	const miss = [br, plain].some((r) => r.headers.get('x-isr') === 'miss');
	const ok = brOk && plainOk && !miss;
	if (!ok) bad++;
	console.log(
		`${ok ? '✓' : '✗'} ${slug}\n    браузер: ${br.status} ${br.headers.get('content-encoding') ?? 'без сжатия'}, ${source(br.headers)}` +
			`\n    без br:  ${plain.status} ${plain.headers.get('content-encoding') ?? 'без сжатия'}, ${source(plain.headers)}`
	);
}
console.log(
	`\nПроверено ${sample.length}: из готовых файлов ${sample.length - bad}, проблем ${bad}`
);
process.exit(bad ? 1 : 0);

/** Slug книг по файлам `books/{шард}/{slug}.html.br`. */
async function bookSlugs(dir) {
	const files = await readdir(dir, { recursive: true }).catch(() => []);
	return files
		.map((file) => /^[a-z0-9-]{1,2}[/\\]([a-z0-9-]+)\.html\.br$/.exec(file)?.[1])
		.filter(Boolean);
}
