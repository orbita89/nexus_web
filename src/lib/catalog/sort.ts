// Порядок выдачи каталога: ?sort=trending|top_rated|new|soon|popular|rating|title. По умолчанию —
// «Рекомендуемые» (балл бэкенда: рейтинг IMDb + популярность + свежесть), в адрес не пишется (у
// одной выдачи один адрес). popular и rating — по оценкам Nexus, их нет в поиске.
import type { SchemaEntitySort } from '#lib/api/generated/catalog.ts';
import type { UrlLike } from './url.ts';

export type EntitySort = SchemaEntitySort;

export const ENTITY_SORTS: readonly { value: EntitySort; title: string }[] = [
	{ value: 'recommended', title: 'Рекомендуемые' },
	{ value: 'trending', title: 'Смотрят сейчас' },
	{ value: 'top_rated', title: 'Высокий рейтинг' },
	{ value: 'new', title: 'Новинки' },
	{ value: 'soon', title: 'Скоро' },
	{ value: 'popular', title: 'Больше оценок Nexus' },
	{ value: 'rating', title: 'Оценки Nexus' },
	{ value: 'title', title: 'По названию' }
];

export const DEFAULT_SORT: EntitySort = 'recommended';

/** Сортировка из ?sort=; неизвестная или нет — «Рекомендуемые». */
export function readEntitySort(url: UrlLike): EntitySort {
	const raw = url.searchParams.get('sort');
	return ENTITY_SORTS.find((s) => s.value === raw)?.value ?? DEFAULT_SORT;
}
