import type { Api } from '#lib/api/client.ts';
import { KINDS } from '#lib/catalog/kinds.ts';

type KindInfo = (typeof KINDS)[number];
import { listPage, SEARCH_MAX_LIMIT } from '#lib/catalog/search.ts';
import { DEFAULT_SORT } from '#lib/catalog/sort.ts';

// Страница тега: список его работ одного или нескольких разделов. Нужна и серверу (статика —
// вкладка по умолчанию), и браузеру (другая вкладка из ?kind=).

/** Потолок на случай огромного тега: больше этого за раз не тянем. */
const MAX_SHOWN = 1000;

/** Вкладка по умолчанию: первый раздел, где у тега есть работы (сезоны — это сериалы). */
export function defaultKinds(byKind: Partial<Record<string, number>>): KindInfo[] {
	const first = KINDS.find(
		(k) => (byKind[k.kind] ?? 0) > 0 || (k.kind === 'series' && (byKind.season ?? 0) > 0)
	);
	return first ? [first] : [];
}

/** Все работы тега в разделах kinds (до MAX_SHOWN): первая порция, затем остальное разом. */
export async function tagList(api: Api, slug: string, kinds: readonly KindInfo[]) {
	const kind = kinds.map((k) => k.kind);
	const chunk = (offset: number) =>
		listPage(api, { tag: slug }, { kind, sort: DEFAULT_SORT, limit: SEARCH_MAX_LIMIT, offset });
	const first = await chunk(0);
	const total = Math.min(first.total, MAX_SHOWN);
	const offsets: number[] = [];
	for (let o = first.items.length; o < total; o += SEARCH_MAX_LIMIT) offsets.push(o);
	const rest = await Promise.all(offsets.map(chunk));
	return { ...first, items: [...first.items, ...rest.flatMap((r) => r.items)] };
}
