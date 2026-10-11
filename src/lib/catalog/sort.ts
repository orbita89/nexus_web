// Порядок выдачи каталога: ?sort=new|popular|rating|title. «Новые» — по умолчанию, в адрес не
// пишется (у одной выдачи один адрес).
import type { SchemaEntitySort } from '#lib/api/generated/catalog.ts';
import type { UrlLike } from './url.ts';

export type EntitySort = SchemaEntitySort;

export const ENTITY_SORTS: readonly { value: EntitySort; title: string }[] = [
	{ value: 'new', title: 'Новые' },
	{ value: 'popular', title: 'Популярные' },
	{ value: 'rating', title: 'По оценке' },
	{ value: 'title', title: 'По названию' }
];

export const DEFAULT_SORT: EntitySort = 'new';

/** Сортировка из ?sort=; неизвестная или нет — «новые». */
export function readEntitySort(url: UrlLike): EntitySort {
	const raw = url.searchParams.get('sort');
	return ENTITY_SORTS.find((s) => s.value === raw)?.value ?? DEFAULT_SORT;
}
