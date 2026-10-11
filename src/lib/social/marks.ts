// Личные отметки: «Посмотреть позже» и «Просмотрено» (у книг — прочитать, у игр — пройти).
// Взаимоисключающие: просмотрел — из «позже» уходит. Подписи и список своих отметок — без Svelte;
// отметка на карточке — Marks (marks.svelte.ts).
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
import type { SchemaMarkKind, SchemaPageMarkedEntity } from '#lib/api/generated/social.ts';

export type Mark = SchemaMarkKind;

/** Подписи по типу: «Посмотреть позже» / «Просмотрено», «Прочитать позже» / «Прочитано»… */
export function markLabels(kind: SchemaEntityKind): Record<Mark, string> {
	switch (kind) {
		case 'book':
			return { later: 'Прочитать позже', done: 'Прочитано' };
		case 'game':
			return { later: 'Пройти позже', done: 'Пройдено' };
		default:
			return { later: 'Посмотреть позже', done: 'Просмотрено' };
	}
}

/**
 * Свои отметки одного вида, новые сверху — для будущего кабинета (страницы пока нет: в
 * docs/design.md она не описана). Клиент — с токеном (`api` из session).
 */
export function listMyMarks(
	client: Pick<Api, 'social'>,
	kind: Mark,
	{ limit = 24, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<SchemaPageMarkedEntity> {
	return unwrap(
		client.social.GET('/api/v1/social/users/me/marks', {
			params: { query: { kind, limit, offset } }
		})
	);
}
