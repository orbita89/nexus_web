import { loadCollection } from '#lib/social/collectionLoad.ts';
import type { PageLoad } from './$types';

// Коллекция по UUID или slug особой; редиректы, кэш и похожие — см. loadCollection.
export const load: PageLoad = (event) => loadCollection(event);
