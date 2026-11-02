// Ряд листания: откуда человек пришёл к карточке. Со страницы художника следующей идёт его же
// работа, с тега — работа тега, из раздела или поиска — та же выдача в том же порядке.
//
// Храним не список работ, а параметры выдачи: соседей по ним считает бэкенд
// (GET /catalog/entities/{slug}/neighbors). Параметры живут в sessionStorage, а не в адресе:
// ссылки на карточки остаются чистыми, без дублей для поиска.
import type { SchemaEntityKind, SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import type { CatalogFilters } from './filters.ts';

const KEY = 'nexus:row';
const SEEN_KEY = 'nexus:seen';
/** Сколько последних работ помним, чтобы листание не ходило по кругу между двумя карточками. */
const MAX_SEEN = 30;

/** Выдача, из которой открыли карточку: те же параметры, с которыми её грузил список. */
export interface Row {
	filters: CatalogFilters;
	kind?: SchemaEntityKind;
	sort?: SchemaSearchSort;
}

function isRow(value: unknown): value is Row {
	return typeof value === 'object' && value !== null && 'filters' in value;
}

/** Запомнить ряд (клик по карточке в списке). Хранилище недоступно — молча живём без ряда. */
export function rememberRow(row: Row): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(row));
	} catch {
		// Приватный режим или переполнение: листание просто пойдёт по похожим.
	}
}

/** Ряд последнего открытого списка; его нет (прямой заход, новая вкладка) — null. */
export function readRow(): Row | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const row: unknown = JSON.parse(raw);
		return isRow(row) ? row : null;
	} catch {
		return null;
	}
}

/** Ряд себя исчерпал (работы в нём нет) — забываем, чтобы не спрашивать соседей впустую. */
export function forgetRow(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// Нечего забывать.
	}
}

/** Эту работу уже показывали: следующая постарается её не предлагать. */
export function markSeen(slug: string): void {
	try {
		const seen = [slug, ...recentlySeen().filter((s) => s !== slug)].slice(0, MAX_SEEN);
		sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
	} catch {
		// Без хранилища листание просто иногда повторится.
	}
}

/** Недавно показанные работы, свежие первыми. */
export function recentlySeen(): string[] {
	try {
		const raw: unknown = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]');
		return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
	} catch {
		return [];
	}
}
