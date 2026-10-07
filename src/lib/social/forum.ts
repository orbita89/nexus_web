// Форум: сортировка тем, ветки ответов, проверка формы, автоссылки и «5 минут назад».
// Сообщения приходят плоским списком по времени; ветку показываем цитатой «↳ в ответ @user».
import type { SchemaPost, SchemaThreadSort } from '#lib/api/generated/social.ts';
import type { UrlLike } from '#lib/catalog/url.ts';
import { plural } from '#lib/catalog/labels.ts';

export type ThreadSort = SchemaThreadSort;

export const THREAD_SORTS: readonly { value: ThreadSort; title: string }[] = [
	{ value: 'active', title: 'Активные' },
	{ value: 'new', title: 'Новые' }
];

/** Сортировка тем из ?sort=; по умолчанию — активные. */
export function readThreadSort(url: UrlLike): ThreadSort {
	const raw = url.searchParams.get('sort');
	return THREAD_SORTS.find((s) => s.value === raw)?.value ?? 'active';
}

export function threadSortParam(sort: ThreadSort): ThreadSort | null {
	return sort === 'active' ? null : sort;
}

/** Сообщений на странице темы (по умолчанию бэкенда). */
export const POSTS_PAGE = 50;

/** offset последней страницы: туда попадает новое сообщение. */
export function lastPageOffset(total: number, limit: number): number {
	return total <= 0 ? 0 : Math.floor((total - 1) / limit) * limit;
}

/** Создавать темы могут author и admin (бэкенд: user — 403). */
export function canCreateThreads(role: string | undefined | null): boolean {
	return role === 'author' || role === 'admin';
}

export const LIMITS = { title: 200, threadBody: 20_000, postBody: 10_000, entities: 10 };

/** Проверка формы темы — те же правила, что у бэкенда; null — всё в порядке. */
export function threadFormError(form: { title: string; body: string; entities: unknown[] }) {
	const title = form.title.trim();
	const body = form.body.trim();
	if (!title) return 'Введите заголовок.';
	if (title.length > LIMITS.title) return `Заголовок — не длиннее ${LIMITS.title} символов.`;
	if (!body) return 'Напишите текст темы.';
	if (body.length > LIMITS.threadBody) return 'Текст темы — не длиннее 20 000 символов.';
	if (!form.entities.length) return 'Выберите хотя бы одно произведение.';
	if (form.entities.length > LIMITS.entities) return 'Не больше 10 произведений.';
	return null;
}

export interface Quote {
	/** Сообщение, на которое ответ, есть на этой странице — к нему можно прокрутить. */
	targetId: string | null;
	author: string | null;
	excerpt: string | null;
}

/**
 * Цитата над ответом. Исходное на этой странице — с началом текста и ссылкой; на другой
 * странице — только «в ответ @user»; исходное удалено — «на удалённое сообщение».
 */
export function quoteFor(post: SchemaPost, page: readonly SchemaPost[]): Quote | null {
	if (!post.parent_id) return null;
	const parent = page.find((p) => p.id === post.parent_id);
	if (parent?.deleted || (!parent && !post.reply_to)) {
		return { targetId: parent?.id ?? null, author: null, excerpt: null };
	}
	return {
		targetId: parent?.id ?? null,
		author: post.reply_to?.username ?? parent?.author?.username ?? null,
		excerpt: parent?.body ? excerpt(parent.body) : null
	};
}

/** Начало текста одной строкой: до 80 символов, обрезка по слову. */
export function excerpt(text: string, max = 80): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	if (flat.length <= max) return flat;
	const cut = flat.slice(0, max);
	const space = cut.lastIndexOf(' ');
	return `${space > max / 2 ? cut.slice(0, space) : cut}…`;
}

export type TextPart = { text: string } | { href: string; text: string };

// Знаки препинания в конце адреса — скорее конец предложения: «см. https://x.ru/a.»
const URL_RE = /https?:\/\/[^\s<>"'«»]+/g;
const TRAILING = /[.,!?:;)\]»"']+$/;

/** Текст с адресами http(s) → части для вывода: обычный текст и ссылки. Никакого HTML. */
export function linkify(text: string): TextPart[] {
	const parts: TextPart[] = [];
	let last = 0;
	for (const match of text.matchAll(URL_RE)) {
		const url = match[0].replace(TRAILING, '');
		const start = match.index;
		if (start > last) parts.push({ text: text.slice(last, start) });
		parts.push({ href: url, text: url });
		last = start + url.length;
	}
	if (last < text.length) parts.push({ text: text.slice(last) });
	return parts;
}

/** «только что», «5 минут назад», «3 часа назад», «вчера», дальше — дата. */
export function timeAgo(iso: string, now: number): string {
	const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
	if (seconds < 60) return 'только что';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} ${plural(minutes, ['минуту', 'минуты', 'минут'])} назад`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ${plural(hours, ['час', 'часа', 'часов'])} назад`;
	const days = Math.floor(hours / 24);
	if (days === 1) return 'вчера';
	if (days < 7) return `${days} ${plural(days, ['день', 'дня', 'дней'])} назад`;
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}
