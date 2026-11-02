// Ряд листания: откуда человек пришёл к карточке. Со страницы художника следующей идёт его же
// работа, с тега — работа тега, из раздела или поиска — ровно тот список, что был на экране, в том
// же порядке. Ряд живёт в sessionStorage (одно место — «текущий ряд»), а не в адресе: ссылки на
// карточки остаются чистыми, без ?seq и дублей для поиска.
import type { SchemaEntityKind, SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import type { CatalogFilters } from './filters.ts';

const KEY = 'nexus:row';
/** Больше слотов не храним: sessionStorage — не база, а ряд всё равно дочитывается порциями. */
const MAX_SLUGS = 500;

/** Чем дочитать ряд дальше — те же параметры, с которыми список грузила страница. */
export interface RowQuery {
	filters: CatalogFilters;
	kind?: SchemaEntityKind;
	sort?: SchemaSearchSort;
}

export interface Row {
	/** Подпись ряда на карточке: «Поль Гоген», «Постимпрессионизм», «Картины». */
	label: string;
	/** Порядок — ровно тот, что человек видел в списке. */
	slugs: string[];
	/** Сколько всего в ряду: по нему видно, есть ли что дочитывать. */
	total: number;
	/** Нет — ряд пришёл целиком (фильмография человека), дочитывать нечего. */
	more?: RowQuery;
}

/** Ряд без слотов: их список знает сам компонент — он же и рисует работы. */
export type RowSource = Omit<Row, 'slugs' | 'total'> & { total?: number };

/** Ряд из того, что сейчас на экране: total по умолчанию — столько же, сколько показано. */
export function buildRow(source: RowSource, slugs: string[]): Row {
	return { ...source, slugs, total: source.total ?? slugs.length };
}

function isRow(value: unknown): value is Row {
	if (typeof value !== 'object' || value === null) return false;
	const row = value as Partial<Row>;
	return (
		typeof row.label === 'string' &&
		Array.isArray(row.slugs) &&
		row.slugs.every((s) => typeof s === 'string') &&
		typeof row.total === 'number'
	);
}

/** Запомнить ряд (клик по карточке в списке). Хранилище недоступно — молча живём без ряда. */
export function rememberRow(row: Row): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify({ ...row, slugs: row.slugs.slice(0, MAX_SLUGS) }));
	} catch {
		// Приватный режим или переполнение: листание просто пойдёт по «Похожим».
	}
}

/** Ряд для этой работы; её нет в ряду (прямой заход, новая вкладка) — null. */
export function readRow(slug: string): Row | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const row: unknown = JSON.parse(raw);
		return isRow(row) && row.slugs.includes(slug) ? row : null;
	} catch {
		return null;
	}
}

/** Дочитанная порция в конец ряда, без повторов; результат сразу запоминается. */
export function extendRow(row: Row, slugs: string[]): Row {
	const known = new Set(row.slugs);
	const next: Row = { ...row, slugs: [...row.slugs, ...slugs.filter((s) => !known.has(s))] };
	rememberRow(next);
	return next;
}

/** Соседи работы в ряду: нет предыдущей или следующей — null. */
export function neighbours(row: Row, slug: string) {
	const at = row.slugs.indexOf(slug);
	return {
		at,
		prev: at > 0 ? row.slugs[at - 1] : null,
		next: at >= 0 && at < row.slugs.length - 1 ? row.slugs[at + 1] : null,
		/** Показанных слотов меньше, чем всего в ряду, и есть чем дочитать. */
		canExtend: row.slugs.length < row.total && !!row.more
	};
}
