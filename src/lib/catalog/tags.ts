// Теги и жанры: справочник на /tags. Разбивку счётчика по разделам, фильтр ?entity_kind= и
// description бэкенд сделал (f1daac0), но контракт documents/api/catalog.json он не перегенерил —
// в generated/catalog.ts новых полей нет. Поэтому они описаны здесь; когда контракт обновят,
// `pnpm api:types`, а отсюда уходят TagEntry и приведения в listTags/tagBody.
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type {
	SchemaEntityKind,
	SchemaTagKind,
	SchemaTagWithCount
} from '#lib/api/generated/catalog.ts';
import { count } from '#lib/catalog/labels.ts';
import { kindWords } from '#lib/catalog/kinds.ts';

/** `TagWithCount` с полями, которых в контракте ещё нет. */
export type TagEntry = SchemaTagWithCount & {
	/** Сколько активных сущностей каждого типа: `{ movie: 52132, series: 51 }`. Нулей нет. */
	by_kind?: Partial<Record<SchemaEntityKind, number>>;
	description?: string | null;
};

/** Справочник тегов, при желании — только с работами выбранного типа (`?entity_kind=`). */
export async function listTags(api: Api, kind?: SchemaEntityKind): Promise<TagEntry[]> {
	// `entity_kind` в контракте пока не описан, поэтому query собираем сами: в запрос уходит как есть.
	const query = (kind ? { entity_kind: kind } : {}) as { kind?: SchemaTagKind };
	return unwrap(api.catalog.GET('/api/v1/catalog/tags', { params: { query } }));
}

/**
 * Тело создания и правки тега с описанием: пустая строка — `null` (бэкенд так и трактует).
 * Если описание не менялось (`was` совпадает) — поля в теле нет, бэкенд оставит как было.
 */
export function tagBody<T extends object>(body: T, description: string, was?: string): T {
	const next = description.trim();
	if (was !== undefined && next === was.trim()) return body;
	return { ...body, description: next || null };
}

/** Счётчик на карточке: в разделе — его словами («391 картина»), без раздела — нейтрально. */
export function tagCount(tag: TagEntry, kind?: SchemaEntityKind): string {
	if (kind) return count(tag.by_kind?.[kind] ?? 0, kindWords(kind));
	return count(tag.entities_count, ['произведение', 'произведения', 'произведений']);
}
