// Генерирует TypeScript-типы API из OpenAPI-контрактов бэкенда (documents/api/*.json).
// Путь к бэкенду — NEXUS_BACKEND_DIR, по умолчанию соседний каталог ../nexus_project.
// --check: не пишет файлы, а падает, если сгенерированные типы устарели (для CI).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const backend = path.resolve(process.env.NEXUS_BACKEND_DIR ?? '../nexus_project');
const specs = { auth: 'openapi.json', catalog: 'catalog.json', social: 'social.json' };
const check = process.argv.includes('--check');
const outDir = check ? mkdtempSync(path.join(tmpdir(), 'nexus-api-')) : 'src/lib/api/generated';
const fixedDir = mkdtempSync(path.join(tmpdir(), 'nexus-spec-'));

// Ссылки на схемы, которых нет в components, генератор не переваривает. Такие места заменяем
// на string и предупреждаем: это ошибка контракта, её нужно исправить в бэкенде.
function fixMissingRefs(spec, file) {
	const schemas = spec.components?.schemas ?? {};
	const walk = (node) => {
		if (Array.isArray(node)) return node.map(walk);
		if (node === null || typeof node !== 'object') return node;
		const ref = node.$ref;
		if (typeof ref === 'string' && ref.startsWith('#/components/schemas/')) {
			const name = ref.slice('#/components/schemas/'.length);
			if (!(name in schemas)) {
				console.warn(`⚠ ${file}: нет схемы ${name}, подставлен string`);
				return { type: 'string' };
			}
		}
		return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
	};
	return walk(spec);
}

// operationId должен быть уникален (OpenAPI), иначе в типах дублируются operations. Повторы
// переименовываем по методу и пути: get + /api/v1/social/collections/{id} → get_collections_id.
function fixDuplicateOperationIds(spec, file) {
	const ops = Object.entries(spec.paths ?? {}).flatMap(([p, item]) =>
		Object.entries(item)
			.filter(([, op]) => op && typeof op === 'object' && 'operationId' in op)
			.map(([method, op]) => ({ p, method, op }))
	);
	const count = {};
	for (const { op } of ops) count[op.operationId] = (count[op.operationId] ?? 0) + 1;
	const dups = Object.keys(count).filter((id) => count[id] > 1);
	if (dups.length) console.warn(`⚠ ${file}: повторяются operationId: ${dups.join(', ')}`);
	for (const { p, method, op } of ops) {
		if (count[op.operationId] > 1) {
			const tail = p.split('/').slice(4).join('_').replace(/[{}]/g, '').replace(/-/g, '_');
			op.operationId = `${method}_${tail}`;
		}
	}
	return spec;
}

let stale = false;
for (const [name, file] of Object.entries(specs)) {
	const spec = path.join(backend, 'documents/api', file);
	if (!existsSync(spec)) {
		console.error(`Нет контракта ${spec}. Укажите путь к бэкенду в NEXUS_BACKEND_DIR.`);
		process.exit(1);
	}
	const fixed = path.join(fixedDir, file);
	writeFileSync(
		fixed,
		JSON.stringify(
			fixDuplicateOperationIds(fixMissingRefs(JSON.parse(readFileSync(spec, 'utf8')), file), file)
		)
	);
	const out = path.join(outDir, `${name}.ts`);
	execFileSync('openapi-typescript', [fixed, '-o', out, '--root-types'], { stdio: 'inherit' });
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
