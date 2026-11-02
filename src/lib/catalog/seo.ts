// Канонический адрес страницы. Состояние списков живёт в адресе (url.ts), поэтому у одной и той
// же выдачи десятки адресов: ?sort=new, ?offset=24, ?archive=1, utm-метки. Для поиска это дубли —
// он делит вес между ними и тратит обход впустую. Канонический адрес схлопывает их в один.
//
// Оставляем только те параметры, которые делают страницу самостоятельной и полезной во внешнем
// поиске: раздел и тег («фантастика книги» — осмысленный запрос). Порядок и страница — нет:
// /films?sort=new и /films — одно и то же собрание фильмов.
import type { UrlLike } from './url.ts';

/** Параметры, которые остаются в каноническом адресе, в этом порядке. */
const KEEP = ['kind', 'tag'];

export function canonicalUrl(url: UrlLike, origin: string): string {
	const params = new URLSearchParams();
	for (const key of KEEP) {
		const value = url.searchParams.get(key)?.trim();
		if (value) params.set(key, value);
	}
	const qs = params.toString();
	return `${origin}${url.pathname}${qs ? `?${qs}` : ''}`;
}
