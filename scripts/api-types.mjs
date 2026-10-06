// Генерирует TypeScript-типы API из OpenAPI-контрактов бэкенда (documents/api/*.json).
// Путь к бэкенду — NEXUS_BACKEND_DIR, по умолчанию соседний каталог ../nexus_project.
// --check: не пишет файлы, а падает, если сгенерированные типы устарели (для CI).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const backend = path.resolve(process.env.NEXUS_BACKEND_DIR ?? '../nexus_project');
const specs = { auth: 'openapi.json', catalog: 'catalog.json', social: 'social.json' };
const check = process.argv.includes('--check');
const outDir = check ? mkdtempSync(path.join(tmpdir(), 'nexus-api-')) : 'src/lib/api/generated';

// Ошибки контракта, на которых генератор падает невнятно или молча выдаёт кривые типы. Если они
// снова появятся — останавливаемся с понятным сообщением: чинить нужно в бэкенде.
function contractErrors(spec, file) {
	const errors = [];
	const schemas = spec.components?.schemas ?? {};
	const walk = (node) => {
		if (Array.isArray(node)) return node.forEach(walk);
		if (node === null || typeof node !== 'object') return;
		const ref = node.$ref;
		if (typeof ref === 'string' && ref.startsWith('#/components/schemas/')) {
			const name = ref.slice('#/components/schemas/'.length);
			if (!(name in schemas)) errors.push(`${file}: ссылка на несуществующую схему ${name}`);
		}
		Object.values(node).forEach(walk);
	};
	walk(spec);

	// operationId должен быть уникален (OpenAPI), иначе в типах дублируются operations.
	const seen = {};
	for (const [p, item] of Object.entries(spec.paths ?? {})) {
		for (const [method, op] of Object.entries(item)) {
			const id = op && typeof op === 'object' ? op.operationId : undefined;
			if (typeof id !== 'string') continue;
			if (id in seen) {
				errors.push(`${file}: operationId «${id}» повторяется (${seen[id]} и ${method} ${p})`);
			} else seen[id] = `${method} ${p}`;
		}
	}
	return [...new Set(errors)];
}

let stale = false;
for (const [name, file] of Object.entries(specs)) {
	const spec = path.join(backend, 'documents/api', file);
	if (!existsSync(spec)) {
		console.error(`Нет контракта ${spec}. Укажите путь к бэкенду в NEXUS_BACKEND_DIR.`);
		process.exit(1);
	}
	const errors = contractErrors(JSON.parse(readFileSync(spec, 'utf8')), file);
	if (errors.length) {
		console.error(`Контракт ${spec} сломан, типы не сгенерированы:`);
		for (const e of errors) console.error(`  - ${e}`);
		console.error('Это ошибка бэкенда: исправьте контракт там (см. docs/backend-questions.md).');
		process.exit(1);
	}
	const out = path.join(outDir, `${name}.ts`);
	execFileSync('openapi-typescript', [spec, '-o', out, '--root-types'], { stdio: 'inherit' });
	execFileSync(
		'prettier',
		['--write', '--config', 'prettier.config.js', '--log-level', 'warn', out],
		{ stdio: 'inherit' }
	);
	if (check) {
		const current = path.join('src/lib/api/generated', `${name}.ts`);
		if (!existsSync(current) || readFileSync(current, 'utf8') !== readFileSync(out, 'utf8')) {
			console.error(`Устарели типы ${current}: запустите pnpm api:types`);
			stale = true;
		}
	}
}
process.exit(stale ? 1 : 0);
