// Реалтайм в компонентах: один WebSocket на браузер (TabRealtime из tabs.ts поверх Realtime из
// client.ts), и только пока он нужен — сейчас это открытая панель чата у вошедшего.
//
//   useRealtime(() => [`room:${id}`], (event) => …, () => перечитать());
//
// Подписка живёт, пока жив компонент, и меняется вместе с каналами. На сервере (SSR) — ничего.
// Почему сокет есть только у чата — docs/realtime.md.
import { untrack } from 'svelte';
import { browser } from '$app/env';
import { accessToken, session } from '#lib/auth/session.svelte.ts';
import {
	Realtime,
	type RealtimeEvent,
	type RealtimeStatus,
	type ReplyMessage,
	type SocketLike
} from './client.ts';
import { TabRealtime, type ChannelLike } from './tabs.ts';

export type { RealtimeEvent, RealtimeStatus, ReplyMessage };

let instance: TabRealtime | null = null;

/** Статус соединения для интерфейса («Нет связи», «Чат открыт в другом окне»). */
export const realtimeState = $state<{ status: RealtimeStatus }>({ status: 'idle' });

function core(): Realtime {
	return new Realtime({
		connect: () => {
			const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
			return new WebSocket(`${scheme}://${location.host}/ws`) as unknown as SocketLike;
		},
		token: () => accessToken().catch(() => null),
		now: () => Date.now(),
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>)
	});
}

function realtime(): TabRealtime | null {
	if (!browser) return null;
	if (instance) return instance;
	const shared = 'locks' in navigator && typeof BroadcastChannel !== 'undefined';
	const rt = new TabRealtime({
		core,
		channel: () => new BroadcastChannel('nexus-ws') as unknown as ChannelLike,
		lock: shared
			? (onGranted, signal) => navigator.locks.request('nexus-ws', { signal }, onGranted)
			: null,
		tabId: crypto.randomUUID(),
		now: () => Date.now(),
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
		setInterval: (fn, ms) => setInterval(fn, ms),
		clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>)
	});
	rt.onStatus((status) => (realtimeState.status = status));
	document.addEventListener('visibilitychange', () =>
		rt.setVisible(document.visibilityState === 'visible')
	);
	addEventListener('pagehide', () => rt.leave());
	instance = rt;
	return rt;
}

/**
 * Подписка компонента. channels: каналы или null — все события соединения (интересы и комнаты
 * вошедшего сервер подписывает сам). Пустой список — сокет не нужен. onResync — после
 * переподключения, смены главной вкладки и `lagged`: перечитать данные.
 */
export function useRealtime(
	channels: () => string[] | null,
	onEvent: (event: RealtimeEvent) => void,
	onResync?: () => void
) {
	$effect(() => {
		const list = channels();
		if (list && !list.length) return;
		const rt = realtime();
		if (!rt) return;
		return rt.subscribe(
			list,
			(event) => untrack(() => onEvent(event)),
			onResync && (() => untrack(onResync))
		);
	});
}

/** Отправить сообщение в соединение (чат). false — соединения нет. */
export function sendRealtime(message: object): boolean {
	return instance?.send(message) ?? false;
}

/** «Повторить» после offline, «Подключиться здесь» после replaced. */
export function retryRealtime() {
	instance?.retry();
}

/** Ответы сервера на sendRealtime, пока жив компонент. */
export function useRealtimeReplies(listener: (message: ReplyMessage) => void) {
	$effect(() => realtime()?.onReply((message) => untrack(() => listener(message))));
}

/**
 * Вход соединения следует за сессией (токен уходит в уже открытый сокет; сам вход сокет не
 * открывает). Вызывается один раз — в корневом +layout.svelte.
 */
export function syncRealtimeAuth() {
	$effect(() => {
		const authed = session.status === 'authed';
		untrack(() => realtime()?.setAuth(authed));
	});
}
