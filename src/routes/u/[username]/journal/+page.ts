import { publicApi } from '#lib/api/client.ts';
import { loadJournal, readJournalParams } from '#lib/social/journal.ts';
import type { PageLoad } from './$types';

// Журнал, каким его видит гость: без заметок и отметок. На сервере токена нет, поэтому владелец
// перечитывает свой журнал в браузере (см. +page.svelte), а здесь приватные фильтры отбрасываются.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const filters = readJournalParams(url, false);
	const page = await loadJournal(publicApi(fetch, url), params.username, filters, false);
	return { username: params.username, page };
};
