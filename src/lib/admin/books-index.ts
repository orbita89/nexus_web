// Книжный индекс (/admin/books): сводка GET /admin/books/index и чистые помощники страницы.
import type { SchemaBooksIndexStatus } from '#lib/api/generated/catalog.ts';

const UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];

/** 1536 → «1,5 КБ»; до 10 единиц — с одним знаком, дальше целые. */
export function formatBytes(bytes: number): string {
	let n = Math.max(0, bytes);
	let i = 0;
	while (n >= 1024 && i < UNITS.length - 1) {
		n /= 1024;
		i++;
	}
	const digits = i > 0 && n < 10 ? 1 : 0;
	return `${n.toLocaleString('ru', { maximumFractionDigits: digits })} ${UNITS[i]}`;
}

/** 83_500 → «1 мин 24 с»; меньше секунды — в мс. */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)} мс`;
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s} с`;
	const m = Math.floor(s / 60);
	return s % 60 ? `${m} мин ${s % 60} с` : `${m} мин`;
}

/** Доля от целого в процентах, 0–100; при пустом целом — 0. */
export function share(part: number, total: number): number {
	return total > 0 ? Math.min(100, (part / total) * 100) : 0;
}

/** Книг в базе, в Tantivy и в слое Б не поровну — индекс отстал. */
export function isBehind(s: Pick<SchemaBooksIndexStatus, 'db_books' | 'text' | 'sidecar'>) {
	return s.db_books !== s.text.docs || s.db_books !== s.sidecar.books;
}

/** Операция ещё идёт: пока так, страница опрашивает статус. */
export function isRunning(s: Pick<SchemaBooksIndexStatus, 'operation'> | null | undefined) {
	return !!s?.operation && s.operation.finished_at == null;
}

/** Слияние имеет смысл: сегментов больше одного или есть удалённые документы. */
export function canMerge(s: Pick<SchemaBooksIndexStatus, 'text'>) {
	return s.text.segments > 1 || s.text.deleted_docs > 0;
}

/** Подписи операций бэкенда (`op`). */
export const OPERATIONS: Record<string, string> = {
	rebuild: 'перестройка',
	sidecar: 'пересборка слоя Б',
	merge: 'слияние сегментов'
};

export const operationTitle = (op: string) => OPERATIONS[op] ?? op;

/** Подписи групп фасетов слоя Б (`kind`). */
export const FACETS: Record<string, string> = {
	tag: 'Теги',
	person: 'Люди',
	role: 'Роли',
	pub: 'Издательства',
	lang: 'Языки',
	form: 'Виды текста',
	year: 'Годы'
};

/** Подписи видов текста (`forms`). */
export const FORMS: Record<string, string> = {
	book: 'Книги',
	collection: 'Сборники',
	article: 'Статьи',
	document: 'Документы'
};

/**
 * Адрес страницы книги из того, что вставили в поле: slug, путь или полная ссылка
 * («https://…/books/belaya-gvardiya?x=1» → «/books/belaya-gvardiya»). null — не похоже на книгу.
 */
export function bookPagePath(input: string): string | null {
	const text = input.trim();
	const slug = /(?:^|\/books\/)([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:[?#].*)?$/.exec(text)?.[1];
	return slug ? `/books/${slug}` : null;
}
