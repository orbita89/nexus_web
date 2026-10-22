import { loadCollection } from '#lib/social/collectionLoad.ts';
import type { PageLoad } from './$types';

// Похожие подборки: связи админа, затем ранжированные особые.
export const load: PageLoad = (event) => loadCollection(event, { suffix: '/similar' });
