// Списки внутри «Статистики»: оценки, отметки, комментарии. Все три живут на одной странице,
// поэтому страница у них не в адресе (один ?offset= на три списка не поделить), а своя:
// «Показать ещё» дочитывает следующую порцию к уже показанной.
//
// Запросы идут из браузера и с токеном вошедшего — по тем же причинам, что и сводка
// (см. profile-data.svelte.ts): аналитика закрыта по умолчанию, и владельцу нужен токен.
import { untrack } from 'svelte';
import type { Api } from '#lib/api/client.ts';
import { errorMessage, isStatsPrivate } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import { browserApi } from '#lib/social/card-live.svelte.ts';

/** Страница списка, как её отдаёт бэкенд. */
export interface Paged<T> {
	items: T[];
	total: number;
	limit: number;
	offset: number;
}

/** Сколько показываем сразу; «Показать ещё» добавляет столько же. */
export const SECTION_PAGE = 10;

function client(): Api {
	return session.status === 'authed' ? api : browserApi();
}

/**
 * Список с подгрузкой. Смена deps (порядок оценок, вид отметок) начинает его заново с первой
 * страницы — иначе в ленте смешались бы записи из двух фильтров.
 */
export function profileList<K, T>(
	deps: () => K,
	load: (client: Api, key: K, query: { limit: number; offset: number }) => Promise<Paged<T>>,
	{ limit = SECTION_PAGE }: { limit?: number } = {}
) {
	let items = $state<T[]>([]);
	let total = $state<number | null>(null);
	let loading = $state(true);
	let error = $state('');
	let closed = $state(false);
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = deps();
		// Пока сессия грузится — ждём: запрос ушёл бы без токена и вернул 403 владельцу.
		if (session.status === 'loading') return;
		let stale = false;
		items = [];
		total = null;
		error = '';
		closed = false;
		loading = true;
		untrack(() => load(client(), key, { limit, offset: 0 }))
			.then((page) => {
				if (stale) return;
				items = page.items;
				total = page.total;
			})
			.catch((e) => {
				if (stale) return;
				closed = isStatsPrivate(e);
				error = closed ? '' : errorMessage(e);
			})
			.finally(() => !stale && (loading = false));
		return () => {
			stale = true;
		};
	});

	async function more() {
		if (loading) return;
		loading = true;
		error = '';
		const offset = items.length;
		try {
			const page = await load(client(), deps(), { limit, offset });
			// Запрос мог разойтись со списком, пока шёл (сменили фильтр) — тогда он уже не нужен.
			if (items.length !== offset) return;
			items = [...items, ...page.items];
			total = page.total;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	return {
		get items() {
			return items;
		},
		get total() {
			return total;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		/** Владелец не открывал статистику: не ошибка — просто нечего показывать. */
		get closed() {
			return closed;
		},
		/** Есть ли что дочитывать. */
		get hasMore() {
			return total !== null && items.length < total;
		},
		more,
		retry() {
			attempt++;
		}
	};
}
