// Реалтайм в компонентах: одно соединение на вкладку (Realtime из client.ts), вход — по сессии.
//
//   useRealtime(() => [`thread:${id}`], (event) => …, () => перечитать());
//
// Подписка живёт, пока жив компонент, и меняется вместе с каналами. На сервере (SSR) — ничего.
import { untrack } from 'svelte';
import { browser } from '$app/env';
import { accessToken, session } from '#lib/auth/session.svelte.ts';
import { Realtime, type RealtimeEvent, type ReplyMessage, type SocketLike } from './client.ts';

export type { RealtimeEvent, ReplyMessage };

let instance: Realtime | null = null;

function realtime(): Realtime | null {
	if (!browser) return null;
	instance ??= new Realtime({
		connect: () => {
			const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
			return new WebSocket(`${scheme}://${location.host}/ws`) as unknown as SocketLike;
		},
		token: () => accessToken().catch(() => null),
		now: () => Date.now(),
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>)
	});
	return instance;
}

/**
 * Подписка компонента. channels: каналы или null — все события соединения (лента: интересы
 * сервер подписывает сам). onResync — после переподключения и `lagged`: перечитать данные.
 */
export function useRealtime(
	channels: () => string[] | null,
	onEvent: (event: RealtimeEvent) => void,
	onResync?: () => void
) {
	$effect(() => {
		const rt = realtime();
		if (!rt) return;
		const list = channels();
		// Пустой список — подписываться не на что (гость без открытой комнаты): сокет не открываем.
		if (list && !list.length) return;
		return rt.subscribe(
			list,
			(event) => untrack(() => onEvent(event)),
			onResync && (() => untrack(onResync))
		);
	});
}

/** Отправить сообщение в соединение (чат). false — соединения нет. */
export function sendRealtime(message: object): boolean {
	return realtime()?.send(message) ?? false;
}

/** Ответы сервера на sendRealtime, пока жив компонент. */
export function useRealtimeReplies(listener: (message: ReplyMessage) => void) {
	$effect(() => realtime()?.onReply((message) => untrack(() => listener(message))));
}

/** Вход соединения следует за сессией. Вызывается один раз — в корневом +layout.svelte. */
export function syncRealtimeAuth() {
	$effect(() => {
		const authed = session.status === 'authed';
		untrack(() => realtime()?.setAuth(authed));
	});
}
