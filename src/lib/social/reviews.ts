// Рецензии и оценки: подписи, цвета и состояние списка в адресе. Оценка — целое 1–10, средняя —
// с одним знаком после запятой (бэкенд округляет до 0.1).
import type { SchemaReviewSort } from '#lib/api/generated/social.ts';
import type { UrlLike } from '#lib/catalog/url.ts';

export type ReviewSort = SchemaReviewSort;

export const REVIEW_SORTS: readonly { value: ReviewSort; title: string }[] = [
	{ value: 'new', title: 'Новые' },
	{ value: 'rating_desc', title: 'Сначала высокие' },
	{ value: 'rating_asc', title: 'Сначала низкие' }
];

/** Сортировка из ?sort=; неизвестная или нет — «новые». */
export function readSort(url: UrlLike): ReviewSort {
	const raw = url.searchParams.get('sort');
	return REVIEW_SORTS.find((s) => s.value === raw)?.value ?? 'new';
}

/** Значение ?sort= для адреса: «новые» — по умолчанию, в адрес не пишем. */
export function sortParam(sort: ReviewSort): ReviewSort | null {
	return sort === 'new' ? null : sort;
}

/** Цвет оценки: 7–10 — высокая, 5–6.9 — средняя, ниже — низкая (как у Кинопоиска и Okko). */
export type RatingTone = 'high' | 'mid' | 'low';

export function ratingTone(value: number): RatingTone {
	if (value >= 7) return 'high';
	if (value >= 5) return 'mid';
	return 'low';
}

/** 8 → «8», 6.5 → «6,5»; средняя — всегда с одним знаком: 8 → «8,0». */
export function formatRating(value: number, { average = false } = {}): string {
	return value.toLocaleString('ru-RU', {
		minimumFractionDigits: average ? 1 : 0,
		maximumFractionDigits: 1
	});
}

/**
 * Дата рецензии: «7 октября 2026». По UTC, чтобы сервер и браузер нарисовали одно и то же
 * (иначе у часовых поясов разная дата около полуночи и гидрация расходится).
 */
export function reviewDate(iso: string): string {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** Правили позже, чем через минуту после создания — показываем «изменено». */
export function isEdited(review: { created_at: string; updated_at: string }): boolean {
	return Date.parse(review.updated_at) - Date.parse(review.created_at) > 60_000;
}

/** Как подписать пользователя: отображаемое имя, иначе username. */
export function displayName(user: { username: string; display_name?: string | null }): string {
	return user.display_name?.trim() || user.username;
}

/**
 * Рецензия со спойлерами: текст размыт, пока читатель не откроет. Поля `is_spoiler` в контракте
 * ещё нет (docs/backend-questions.md) — читаем его, если бэкенд уже присылает.
 */
export function isSpoiler(review: object): boolean {
	return 'is_spoiler' in review && review.is_spoiler === true;
}

export const BODY_LIMIT = 10_000;
