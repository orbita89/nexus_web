// Лайки: одно сердечко — у профиля, у человека и у подборки. Это сигнал «мне нравится» для
// раздела «Что нравится» в статистике профиля, а не оценка в обе стороны.
//
// Дизлайка нет нигде. Бэкенд у подборок его умеет (`PUT …/like` с `value: -1`), но мы шлём
// только `value: 1`: дизлайк ничего не добавляет к «что мне нравится», а кнопок становится
// вдвое больше. У старых записей в ленте `value: -1` ещё попадается — показываем как есть.
//
// У произведений сердечко тоже появилось (бэкенд `5b5b22e`): оценка 1–10 — это рецензия, а
// «нравится» ставят в одно нажатие, и оно наполняет «Что нравится» фильмами и книгами.
import type { SchemaLikeTarget } from '#lib/api/generated/social.ts';
import { entityHref, kindByApi } from '#lib/catalog/kinds.ts';
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';

export type LikeFilter = 'collection' | 'person' | 'entity';

export const LIKE_FILTERS: readonly { value: LikeFilter | undefined; title: string }[] = [
	{ value: undefined, title: 'Все' },
	{ value: 'entity', title: 'Произведения' },
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

/** Ключ строки в ленте «Что нравится»: у каждой цели он свой. */
export function likeKey(target: SchemaLikeTarget): string {
	switch (target.kind) {
		case 'person':
			return `person:${target.person.id}`;
		case 'entity':
			return `entity:${target.entity.id}`;
		case 'collection':
			return `collection:${target.collection_id}`;
		default:
			return 'unknown';
	}
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
		case 'entity': {
			// В social `EntityRef.kind` — строка: незнакомый тип ведём без ссылки, а не в никуда.
			const kind = kindByApi(target.entity.kind as SchemaEntityKind);
			return kind
				? {
						href: entityHref({ kind: kind.kind, slug: target.entity.slug }),
						title: target.entity.title,
						note: kind.one
					}
				: { href: null, title: target.entity.title, note: 'Произведение' };
		}
		default:
			return { href: null, title: 'Неизвестно что', note: 'Лайк' };
	}
}
