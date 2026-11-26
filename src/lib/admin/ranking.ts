// Настройки сортировки по видам (GET/PUT /admin/ranking/kinds): подписи вкладок и полей, разбор
// формы. Балл «Рекомендуемые» = сумма весов × составляющих (0–1); в поиске итог =
// (1 − w)·текст + w·популярность, где w — search_popularity.
import type { SchemaKindRanking } from '#lib/api/generated/catalog.ts';

export type RankKind = 'movie' | 'series' | 'book' | 'game' | 'painting' | 'person';

export const KIND_TITLES: Record<RankKind, string> = {
	movie: 'Фильмы',
	series: 'Сериалы',
	book: 'Книги',
	game: 'Игры',
	painting: 'Картины',
	person: 'Люди'
};

/** Веса балла «Рекомендуемые»: поле, подпись, подсказка. */
export const WEIGHTS = [
	{
		key: 'weight_quality',
		label: 'Рейтинг',
		hint: 'IMDb (если голосов достаточно), иначе оценки на сайте'
	},
	{
		key: 'weight_popularity',
		label: 'Популярность',
		hint: 'TMDB popularity; у книг — сколько работ у автора'
	},
	{ key: 'weight_recency', label: 'Свежесть', hint: 'Новое выше; старое плавно опускается' },
	{ key: 'weight_site', label: 'Активность на сайте', hint: 'Сколько оценок поставили у нас' },
	{ key: 'weight_complete', label: 'Полнота карточки', hint: 'Есть обложка и описание' }
] as const satisfies readonly { key: keyof SchemaKindRanking; label: string; hint: string }[];

/** Тело запроса: копия без служебных полей (бэкенд их всё равно игнорирует). */
export function toBody(s: SchemaKindRanking): SchemaKindRanking {
	return { ...s, kind: undefined, updated_at: undefined };
}

/** Доля в процентах для подписи ползунка поиска: 0.6 → «60% популярность / 40% текст». */
export function searchMix(w: number): string {
	const pop = Math.round(Math.min(1, Math.max(0, w)) * 100);
	return `${pop}% популярность · ${100 - pop}% совпадение текста`;
}

/** Вклад составляющей в балл строки предпросмотра, в процентах от суммы (для полосок). */
export function partShare(part: number, score: number): number {
	return score > 0 ? Math.round((part / score) * 100) : 0;
}
