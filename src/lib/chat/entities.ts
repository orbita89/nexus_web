// Превью карточек в сообщениях чата: ссылку несёт текст, карточку подтягиваем по слагу.
// Кэш на вкладку — одна комната может ссылаться на один фильм десятки раз.
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
import { unwrap } from '#lib/api/errors.ts';
import { guestApi } from '#lib/auth/session.svelte.ts';

export interface CardPreview {
	kind: SchemaEntityKind;
	slug: string;
	title: string;
	cover_url?: string | null;
	release_date?: string | null;
}

/** null — загрузили и не нашли: больше не просим. */
const cache = new Map<string, CardPreview | null>();
const pending = new Map<string, Promise<CardPreview | null>>();

export const cached = (slug: string) => cache.get(slug);

/** Карточка по слагу; параллельные запросы одной и той же — один поход в сеть. */
export function loadEntity(slug: string): Promise<CardPreview | null> {
	if (cache.has(slug)) return Promise.resolve(cache.get(slug)!);
	const running = pending.get(slug);
	if (running) return running;
	const request = unwrap(
		guestApi.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path: { slug } } })
	)
		.then((entity) => {
			const preview: CardPreview = {
				kind: entity.kind,
				slug: entity.slug,
				title: entity.title,
				cover_url: entity.cover_url,
				release_date: entity.release_date
			};
			cache.set(slug, preview);
			return preview;
		})
		.catch(() => {
			// Нет карточки или нет сети — в сообщении останется обычная ссылка.
			cache.set(slug, null);
			return null;
		})
		.finally(() => pending.delete(slug));
	pending.set(slug, request);
	return request;
}
