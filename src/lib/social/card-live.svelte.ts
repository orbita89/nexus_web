// Живые данные статической карточки: оценки, рецензии, обсуждения, коллекции. HTML и
// __data.json карточки — статика (только каталог), а это грузится в браузере из API и
// перечитывается по событиям реалтайма и после своих действий — без invalidateAll, который
// перечитал бы лишь статический __data.json.
import { untrack } from 'svelte';
import { createApi } from '#lib/api/client.ts';
import { settle, type Loaded } from '#lib/catalog/load.ts';

/** Публичный API из браузера (запросы liveQuery): тот же домен, без токена. */
export const browserApi = () => createApi({ baseUrl: '', fetch: (request) => fetch(request) });

/** Сигнал «перечитать живые блоки карточки»: один на страницу, блоки следят за version. */
export class CardLive {
	version = $state(0);

	refresh() {
		this.version++;
	}
}

/**
 * Запрос, который выполняется в браузере и повторяется при смене deps (slug, сортировка,
 * CardLive.version). current: null — ещё грузится; при повторе старые данные остаются на месте до
 * ответа, ответ на устаревший запрос отбрасывается. На сервере (пререндер) не выполняется.
 */
export function liveQuery<K, T>(deps: () => K, load: (key: K) => Promise<T>) {
	let current = $state<Loaded<T> | null>(null);
	let attempt = $state(0);
	$effect(() => {
		void attempt;
		const key = deps();
		let stale = false;
		// Зависимости — только deps: что читает сам запрос, его не перезапускает.
		void settle(untrack(() => load(key))).then((result) => {
			if (!stale) current = result;
		});
		return () => {
			stale = true;
		};
	});
	return {
		get current() {
			return current;
		},
		/** «Повторить» после ошибки. */
		retry() {
			attempt++;
		}
	};
}
