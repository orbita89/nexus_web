// Аналитика профиля: оценки, отметки, комментарии, сводка, рейтинг («карма») и лайки.
//
// Аналитика закрыта по умолчанию: четыре эндпоинта (`stats`, `ratings`, `marks`, `comments`)
// отвечают чужому и гостю 403 с code `stats_private` — это штатный ответ, а не сбой
// (см. isStatsPrivate в #lib/api/errors.ts). Рисовать вкладки или нет, решаем по `stats_public`
// из шапки профиля; владелец и админ видят их всегда.
import type {
	SchemaMarkKind,
	SchemaReputation,
	SchemaUserCommentTarget
} from '#lib/api/generated/social.ts';
import type { User } from '#lib/auth/core.ts';
import { entityHref, asKind } from '#lib/catalog/kinds.ts';

/** Видит ли аналитику этого профиля вошедший (или гость — тогда user = null). */
export function canSeeStats(
	profile: { user: { username: string }; stats_public: boolean },
	viewer: Pick<User, 'username' | 'role'> | null
): boolean {
	if (profile.stats_public) return true;
	if (!viewer) return false;
	return viewer.username === profile.user.username || viewer.role === 'admin';
}

/**
 * Порядок оценок (тот же набор, что у рецензий, но свой тип в контракте). Порядок и вид отметок
 * живут в состоянии раздела, а не в адресе: на «Статистике» три списка сразу, и один `?sort=`
 * на всех не поделить.
 */
export type RatingsSort = 'new' | 'rating_desc' | 'rating_asc';

export const RATINGS_SORTS: readonly { value: RatingsSort; title: string }[] = [
	{ value: 'new', title: 'Новые' },
	{ value: 'rating_desc', title: 'Сначала высокие' },
	{ value: 'rating_asc', title: 'Сначала низкие' }
];

/** Подписи отметок в профиле — общие для всех типов (у списка они вперемешку). */
export const MARK_TITLES: Record<SchemaMarkKind, string> = {
	later: 'Посмотреть позже',
	done: 'Просмотрено'
};

/**
 * Рейтинг («карма»): 30 за регистрацию плюс веса за чужие лайки. Пересчитывается раз в сутки
 * целиком — свежий лайк сразу виден в `likes_count`, а в `score` только после ближайшего прохода.
 */
export const REPUTATION_BASE = 30;

/** Подписи слагаемых для подсказки «из чего сложился балл». */
const PART_TITLES: Record<string, string> = {
	profile_likes: 'Лайки профиля',
	review_likes: 'Лайки ваших рецензий',
	collection_reactions: 'Реакции на ваши коллекции'
};

export interface ReputationPart {
	key: string;
	title: string;
	value: number;
}

/**
 * Слагаемые балла в порядке словаря, затем незнакомые ключи (бэкенд может добавить новые —
 * показываем их как есть, а не прячем). Нули пропускаем: в подсказке они только мешают.
 */
export function reputationParts(reputation: SchemaReputation): ReputationPart[] {
	const parts = (reputation.parts ?? {}) as Record<string, unknown>;
	const keys = [
		...Object.keys(PART_TITLES).filter((k) => k in parts),
		...Object.keys(parts).filter((k) => !(k in PART_TITLES))
	];
	return keys.flatMap((key) => {
		const value = parts[key];
		return typeof value === 'number' && value !== 0
			? [{ key, title: PART_TITLES[key] ?? key, value }]
			: [];
	});
}

/** Где комментарий оставлен: ссылка и подпись для ленты «мои комментарии». */
export interface CommentPlace {
	/** null — тип цели фронтенду ещё не знаком: показываем подпись без ссылки. */
	href: string | null;
	title: string;
	/** Что это за место: «Рецензия», «Человек», «Подборка»… */
	note: string;
}

export function commentPlace(target: SchemaUserCommentTarget): CommentPlace {
	switch (target.kind) {
		case 'entity': {
			const kind = asKind(target.entity.kind);
			return {
				href: kind ? entityHref({ kind, slug: target.entity.slug }) : null,
				title: target.entity.title,
				note: 'Произведение'
			};
		}
		case 'person':
			return {
				href: `/people/${target.person.slug}`,
				title: target.person.full_name,
				note: 'Человек'
			};
		case 'studio':
			return {
				href: `/studios/${target.studio.slug}`,
				title: target.studio.name,
				note: 'Студия'
			};
		case 'review': {
			const kind = asKind(target.entity.kind);
			return {
				// Отдельной страницы у рецензии нет — ведём к рецензиям произведения.
				href: kind ? `${entityHref({ kind, slug: target.entity.slug })}/reviews` : null,
				title: target.entity.title,
				note: 'Рецензия'
			};
		}
		case 'collection':
			return {
				href: `/collections/${target.collection_id}/discussion`,
				title: target.title,
				note: 'Подборка'
			};
		default:
			return { href: null, title: 'Неизвестно где', note: 'Комментарий' };
	}
}

/** Разрез по типам (`{"movie": 30, "book": 12}`) → подписи раздела каталога, пустые — вон. */
export function byKindRows(counts: Record<string, number>): { title: string; value: number }[] {
	return Object.entries(counts).flatMap(([raw, value]) => {
		if (!value) return [];
		const kind = asKind(raw);
		return [{ title: kind ? KIND_TITLES[kind] : raw, value }];
	});
}

const KIND_TITLES: Record<string, string> = {
	movie: 'Фильмы',
	series: 'Сериалы',
	book: 'Книги',
	game: 'Игры'
};
