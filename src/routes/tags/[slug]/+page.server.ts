import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import { defaultKinds, tagList } from '#lib/catalog/tag-page.ts';
import type { PageServerLoad } from './$types';

// Страница тега — статика, как карточка: HTML и __data.json на диске (по папкам из двух символов
// slug, только .br — server/isr.js), отдаёт nginx. Перерисовывается по сигналу бэкенда, когда
// правят тег или его работы (publish::tag_path).
//
// В статике — тег и вкладка по умолчанию. Адрес не читаем: nginx отдаёт файл без учёта query,
// другую вкладку (?kind=) и оценки Кассандра страница грузит в браузере. Список — orError, а не
// ошибка на странице: сбой поиска не должен попасть в статику.
export const prerender = 'auto';

export const load: PageServerLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const tag = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/tags/{slug}', { params: { path: { slug: params.slug } } })
		),
		'Такого тега нет.'
	);
	const kinds = defaultKinds(tag.by_kind);
	const list = await orError(tagList(api, params.slug, kinds));
	return { tag, kinds, list };
};
