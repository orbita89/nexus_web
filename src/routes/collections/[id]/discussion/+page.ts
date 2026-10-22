import { loadCollection } from '#lib/social/collectionLoad.ts';
import type { PageLoad } from './$types';

// Обсуждение коллекции. Комментарии живые — на CDN кэшируем коротко (сами грузятся в браузере).
export const load: PageLoad = (event) =>
	loadCollection(event, {
		suffix: '/discussion',
		cacheControl: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});
