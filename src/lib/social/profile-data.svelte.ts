// Загрузка аналитики профиля в браузере.
//
// Почему не +page.ts: эти четыре эндпоинта владельцу и админу отвечают с токеном, а на сервере
// токенов нет (см. docs/auth.md) — SSR получил бы 403 на собственной же странице. Шапка профиля
// остаётся серверной, а вкладки грузят данные сами, как живые блоки карточки.
//
// 403 с code `stats_private` — штатный ответ «владелец не открывал статистику», а не сбой:
// он приходит в `closed`, а не в `error`, и страница показывает объяснение вместо ошибки.
import { untrack } from 'svelte';
import type { Api } from '#lib/api/client.ts';
import { errorMessage, isStatsPrivate } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import { browserApi } from '#lib/social/card-live.svelte.ts';

/**
 * Запрос за аналитикой профиля: повторяется при смене deps (имя, сортировка, страница), старые
 * данные видны до ответа. Ждёт, пока сессия восстановится: иначе владелец успел бы сходить за
 * своей закрытой статистикой гостем и получить 403.
 */
export function profileQuery<K, T>(deps: () => K, load: (client: Api, key: K) => Promise<T>) {
	let current = $state<T | null>(null);
	let error = $state('');
	let closed = $state(false);
	let loading = $state(true);
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = deps();
		// Пока сессия грузится — ничего не запрашиваем: запрос ушёл бы без токена.
		if (session.status === 'loading') return;
		const client = session.status === 'authed' ? api : browserApi();
		let stale = false;
		loading = true;
		untrack(() => load(client, key))
			.then((data) => {
				if (stale) return;
				current = data;
				error = '';
				closed = false;
			})
			.catch((e) => {
				if (stale) return;
				current = null;
				closed = isStatsPrivate(e);
				error = closed ? '' : errorMessage(e);
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => {
			stale = true;
		};
	});

	return {
		get current() {
			return current;
		},
		get error() {
			return error;
		},
		/** Владелец не открывал статистику: не ошибка — просто нечего показывать. */
		get closed() {
			return closed;
		},
		get loading() {
			return loading;
		},
		retry() {
			attempt++;
		}
	};
}
