import { error } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import { bookFile } from '#lib/reader/access.ts';
import type { PageLoad } from './$types';

// Читалка: только в браузере (файл — по токену пользователя, сам текст в HTML не нужен) и не
// статика. Каталог книги — за названием и тем, публичная ли она.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ fetch, url, params }) => {
	if (params.kind !== 'books') error(404, 'Читать можно только книги.');
	const api = publicApi(fetch, url);
	const entity = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/entities/{slug}', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такой книги в каталоге нет.'
	);
	const file = bookFile(entity.metadata);
	if (!file.has) error(404, 'У этой книги пока нет файла.');
	return { slug: entity.slug, title: entity.title, file };
};
