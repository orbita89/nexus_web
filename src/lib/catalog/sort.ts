// Порядок списков каталога: ?sort=trending|top_rated|new|soon|title. Списки — из Meilisearch
// (GET /search), поэтому и порядки — его. По умолчанию — «Рекомендуемые» (балл бэкенда: рейтинг
// IMDb + популярность + свежесть), в адрес не пишется (у одной выдачи один адрес). Порядков по
// оценкам Nexus нет: их нет в индексе (docs/backend-questions.md).
import type { SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import type { UrlLike } from './url.ts';

export type ListSort = SchemaSearchSort;

export const LIST_SORTS: readonly { value: ListSort; title: string }[] = [
	{ value: 'recommended', title: 'Рекомендуемые' },
	{ value: 'trending', title: 'Смотрят сейчас' },
	{ value: 'top_rated', title: 'Высокий рейтинг' },
	{ value: 'new', title: 'Новинки' },
	{ value: 'soon', title: 'Скоро' },
	{ value: 'title', title: 'По названию' }
];

export const DEFAULT_SORT: ListSort = 'recommended';

/** Порядок из ?sort=; неизвестный или нет — «Рекомендуемые». */
export function readListSort(url: UrlLike): ListSort {
	const raw = url.searchParams.get('sort');
	return LIST_SORTS.find((s) => s.value === raw)?.value ?? DEFAULT_SORT;
}
