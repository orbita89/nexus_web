import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { filmography } from '#lib/catalog/labels.ts';
import { orError } from '#lib/catalog/load.ts';
import type { PageServerLoad } from './$types';

// Страница человека — статика, как карточка: HTML и __data.json на диске (по папкам из двух
// символов slug, только .br — server/isr.js), отдаёт nginx. Рисуется при первом запросе и по
// сигналу бэкенда, когда правят человека или его работы (publish::person_path). Оценки Кассандра
// в статику не попадают — устарели бы; страница грузит их в браузере.
export const prerender = 'auto';

export const load: PageServerLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const person = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/people/{slug}', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такого человека в каталоге нет.'
	);
	return { person, roles: filmography(person.credits) };
};
