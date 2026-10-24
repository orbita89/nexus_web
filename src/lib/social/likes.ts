// Лайки: подборкам — лайк и дизлайк (один голос на зрителя, как у рецензий), людям — только
// лайк. Это сигнал «мне нравится» для раздела «Что нравится» в статистике профиля.
//
// У произведений лайков нет и не будет: там оценки 1–10, отметки и реакции. Бэкенд принимает
// `target=entity` (чтобы не ломать контракт), но всегда отдаёт пустую страницу, а
// `likes_given.entities` всегда 0 — поэтому в интерфейсе такого фильтра нет.
import type { SchemaLikeTarget } from '#lib/api/generated/social.ts';

/** Голос за подборку: 1 — нравится, −1 — не нравится. */
export type LikeValue = 1 | -1;

/** Что показываем в ленте «Что нравится»; `entity` сознательно не предлагаем (см. выше). */
export type LikeFilter = 'collection' | 'person';

export const LIKE_FILTERS: readonly { value: LikeFilter | undefined; title: string }[] = [
	{ value: undefined, title: 'Все' },
	{ value: 'collection', title: 'Подборки' },
	{ value: 'person', title: 'Люди' }
];

/** Куда поставлен лайк: ссылка и подпись для ленты. */
export interface LikePlace {
	/** null — вид цели фронтенду ещё не знаком: подпись без ссылки. */
	href: string | null;
	title: string;
	note: string;
}

export function likePlace(target: SchemaLikeTarget): LikePlace {
	switch (target.kind) {
		case 'collection':
			return {
				href: `/collections/${target.collection_id}`,
				title: target.title,
				note: 'Подборка'
			};
		case 'person':
			return {
				href: `/people/${target.person.slug}`,
				title: target.person.full_name,
				note: 'Человек'
			};
		default:
			return { href: null, title: 'Неизвестно что', note: 'Лайк' };
	}
}
