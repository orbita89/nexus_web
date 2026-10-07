// WebSocket-клиент реалтайма (протокол — nexus_project/documents/modules/realtime.md).
// Без Svelte и без браузерных глобалов: сокет, таймеры и токен приходят снаружи — так клиент
// проверяется unit-тестами (realtime.spec.ts).
//
// - одно соединение на вкладку, открывается при первой подписке или входе;
// - подписки со счётчиком: два компонента на одном канале — одна подписка на сервере;
// - обрыв — переподключение с паузой 1, 2, 4, … 30 с, затем auth и subscribe заново, а
//   подписчики получают resync: события за время разрыва не повторяются, данные надо перечитать;
// - токен живёт 15 минут, соединение — часами: auth повторяется до истечения токена.

export interface SocketLike {
	readonly readyState: number;
	send(data: string): void;
	close(): void;
	onopen: (() => void) | null;
	onclose: (() => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
}

export interface RealtimeDeps {
	connect(): SocketLike;
	/** Access-токен вошедшего (обновляется сам, если истекает) или null для гостя. */
	token(): Promise<string | null>;
	now(): number;
	setTimeout(fn: () => void, ms: number): unknown;
	clearTimeout(id: unknown): void;
}

export interface RealtimeEvent {
	event: string;
	channels: string[];
	data: Record<string, unknown>;
}

type ServerMessage =
	| { type: 'authenticated'; expires_at: string; channels: string[] }
	| { type: 'auth_expiring'; expires_at: string }
	| { type: 'auth_expired' }
	| { type: 'event'; event: string; channels: string[]; data: Record<string, unknown> }
	| { type: 'lagged'; missed: number }
	| { type: 'subscribed' | 'unsubscribed'; channels: string[] }
	| { type: 'error'; error: string }
	| { type: 'pong' };

const OPEN = 1;
/** Повторить auth за столько до истечения: accessToken() обновляет токены моложе 30 с. */
const RENEW_BEFORE_MS = 25_000;

/** Пауза перед переподключением: 1, 2, 4, 8, 16, 30, 30, … секунд. */
export function backoff(attempt: number): number {
	return Math.min(30_000, 1000 * 2 ** attempt);
}

/** user:me и каналы интересов сервер подписывает сам после auth. */
const isAutomatic = (channel: string) => channel.startsWith('user:');

interface Subscription {
	/** null — все события (лента: интересы подписываются сервером). */
	channels: Set<string> | null;
	onEvent: (event: RealtimeEvent) => void;
	onResync?: () => void;
}

export class Realtime {
	#deps: RealtimeDeps;
	#socket: SocketLike | null = null;
	#counts = new Map<string, number>();
	#subs = new Set<Subscription>();
	#wantAuth = false;
	#attempt = 0;
	#reconnectTimer: unknown = null;
	#renewTimer: unknown = null;
	#connectedOnce = false;

	constructor(deps: RealtimeDeps) {
		this.#deps = deps;
	}

	/**
	 * Подписаться на каналы (`thread:<id>`, `entity:<slug>`, `user:me`) или на все события
	 * (`channels = null`). Возвращает отписку.
	 */
	subscribe(
		channels: string[] | null,
		onEvent: (event: RealtimeEvent) => void,
		onResync?: () => void
	): () => void {
		const sub: Subscription = { channels: channels && new Set(channels), onEvent, onResync };
		this.#subs.add(sub);
		const added = (channels ?? []).filter((c) => !isAutomatic(c) && this.#inc(c));
		this.#ensureSocket();
		if (added.length) this.#send({ type: 'subscribe', channels: added });
		return () => {
			if (!this.#subs.delete(sub)) return;
			const removed = (channels ?? []).filter((c) => !isAutomatic(c) && this.#dec(c));
			if (removed.length) this.#send({ type: 'unsubscribe', channels: removed });
		};
	}

	/** Вошли — auth в текущее соединение; вышли — новое гостевое соединение. */
	setAuth(authed: boolean) {
		if (authed === this.#wantAuth) return;
		this.#wantAuth = authed;
		if (authed) {
			if (this.#socket?.readyState === OPEN) void this.#auth();
			else this.#ensureSocket();
		} else {
			this.#clearRenew();
			this.#restart();
		}
	}

	/** Закрыть соединение (тесты, выход со страницы). */
	close() {
		this.#deps.clearTimeout(this.#reconnectTimer);
		this.#clearRenew();
		const socket = this.#socket;
		this.#socket = null;
		if (socket) {
			socket.onclose = null;
			socket.close();
		}
	}

	#inc(channel: string): boolean {
		const n = this.#counts.get(channel) ?? 0;
		this.#counts.set(channel, n + 1);
		return n === 0;
	}

	#dec(channel: string): boolean {
		const n = (this.#counts.get(channel) ?? 0) - 1;
		if (n > 0) this.#counts.set(channel, n);
		else this.#counts.delete(channel);
		return n <= 0;
	}

	#send(message: object) {
		if (this.#socket?.readyState === OPEN) this.#socket.send(JSON.stringify(message));
	}

	#ensureSocket() {
		if (this.#socket || this.#reconnectTimer) return;
		if (!this.#subs.size && !this.#wantAuth) return;
		const socket = this.#deps.connect();
		this.#socket = socket;
		socket.onopen = () => void this.#onOpen();
		socket.onmessage = (event) => this.#onMessage(event.data);
		socket.onclose = () => this.#onClose(socket);
	}

	#restart() {
		this.close();
		this.#ensureSocket();
	}

	async #onOpen() {
		this.#attempt = 0;
		if (this.#wantAuth) await this.#auth();
		const channels = [...this.#counts.keys()];
		if (channels.length) this.#send({ type: 'subscribe', channels });
		// Переподключились — пропущенное за разрыв не придёт: открытые экраны перечитывают данные.
		if (this.#connectedOnce) this.#resync();
		this.#connectedOnce = true;
	}

	async #auth() {
		const token = await this.#deps.token();
		if (token) this.#send({ type: 'auth', token });
	}

	#onClose(socket: SocketLike) {
		if (socket !== this.#socket) return;
		this.#socket = null;
		this.#clearRenew();
		const delay = backoff(this.#attempt++);
		this.#reconnectTimer = this.#deps.setTimeout(() => {
			this.#reconnectTimer = null;
			this.#ensureSocket();
		}, delay);
	}

	#onMessage(raw: unknown) {
		let message: ServerMessage;
		try {
			message = JSON.parse(String(raw));
		} catch {
			return;
		}
		switch (message.type) {
			case 'authenticated':
			case 'auth_expiring':
				this.#scheduleRenew(message.expires_at);
				break;
			case 'auth_expired':
				// Не успели продлить (вкладка спала): пробуем войти заново.
				if (this.#wantAuth) void this.#auth();
				break;
			case 'event':
				this.#dispatch(message);
				break;
			case 'lagged':
				this.#resync();
				break;
		}
	}

	#dispatch(event: RealtimeEvent) {
		for (const sub of this.#subs) {
			if (!sub.channels || event.channels.some((c) => sub.channels!.has(c))) sub.onEvent(event);
		}
	}

	#resync() {
		for (const sub of this.#subs) sub.onResync?.();
	}

	#scheduleRenew(expiresAt: string) {
		this.#clearRenew();
		const delay = Math.max(0, Date.parse(expiresAt) - this.#deps.now() - RENEW_BEFORE_MS);
		this.#renewTimer = this.#deps.setTimeout(() => {
			this.#renewTimer = null;
			if (this.#wantAuth) void this.#auth();
		}, delay);
	}

	#clearRenew() {
		if (this.#renewTimer) this.#deps.clearTimeout(this.#renewTimer);
		this.#renewTimer = null;
	}
}
