// WebSocket-клиент реалтайма (протокол — nexus_project/documents/modules/realtime.md).
// Без Svelte и без браузерных глобалов: сокет, таймеры и токен приходят снаружи — так клиент
// проверяется unit-тестами (realtime.spec.ts).
//
// - соединение открывается только при первой подписке (у нас — открытая панель чата вошедшего)
//   и закрывается через IDLE_CLOSE_MS после последней отписки, вход сокет не открывает;
// - один сокет на браузер — слой tabs.ts поверх этого клиента (главная вкладка);
// - подписки со счётчиком: два компонента на одном канале — одна подписка на сервере;
// - обрыв — переподключение с паузой 1, 2, 4, … 30 с (±50 % случайно, чтобы после рестарта
//   сервера клиенты не шли одной волной), не больше MAX_ATTEMPTS подряд — дальше статус offline
//   и кнопка «Повторить» (retry); затем auth и subscribe заново, а подписчики получают resync;
// - код закрытия 4000 (тот же пользователь вошёл в другом окне/устройстве) — статус replaced,
//   без переподключения;
// - токен живёт 15 минут, соединение — часами: auth повторяется до истечения токена.

export interface SocketLike {
	readonly readyState: number;
	send(data: string): void;
	close(): void;
	onopen: (() => void) | null;
	onclose: ((event?: { code?: number }) => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
}

export interface RealtimeDeps {
	connect(): SocketLike;
	/** Access-токен вошедшего (обновляется сам, если истекает) или null для гостя. */
	token(): Promise<string | null>;
	now(): number;
	setTimeout(fn: () => void, ms: number): unknown;
	clearTimeout(id: unknown): void;
	/** 0..1, для разброса пауз переподключения; по умолчанию Math.random. */
	random?(): number;
}

/** idle — сокета нет и не нужен; offline — попытки кончились; replaced — открыт в другом окне. */
export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'offline' | 'replaced';

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
	| { type: 'error'; error: string; client_id?: string; retry_after?: number }
	| { type: 'pong' }
	| { type: 'chat.sent' | 'chat.read_saved'; [key: string]: unknown };

/** Ответ сервера не про события: chat.sent, chat.read_saved, error — для чата. */
export type ReplyMessage = { type: string; [key: string]: unknown };

const OPEN = 1;
/** Повторить auth за столько до истечения: accessToken() обновляет токены моложе 30 с. */
const RENEW_BEFORE_MS = 25_000;
/**
 * Подписок не осталось (чат закрыли): через столько закрыть соединение. Не сразу — панель часто
 * сворачивают и тут же разворачивают, а каждое подключение — рукопожатие и auth.
 */
export const IDLE_CLOSE_MS = 4_000;
/** Подряд неудачных переподключений, после которых сдаёмся до retry(). */
export const MAX_ATTEMPTS = 5;
/** Код закрытия «заменено новым соединением того же пользователя» (сервер). */
export const CLOSE_REPLACED = 4000;

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
	#replies = new Set<(message: ReplyMessage) => void>();
	#wantAuth = false;
	#attempt = 0;
	#reconnectTimer: unknown = null;
	#renewTimer: unknown = null;
	#connectedOnce = false;
	#idleTimer: unknown = null;
	#status: RealtimeStatus = 'idle';
	#statusListeners = new Set<(status: RealtimeStatus) => void>();

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
		this.#deps.clearTimeout(this.#idleTimer);
		this.#idleTimer = null;
		const added = (channels ?? []).filter((c) => !isAutomatic(c) && this.#inc(c));
		this.#ensureSocket();
		if (added.length) this.#send({ type: 'subscribe', channels: added });
		return () => {
			if (!this.#subs.delete(sub)) return;
			const removed = (channels ?? []).filter((c) => !isAutomatic(c) && this.#dec(c));
			if (removed.length) this.#send({ type: 'unsubscribe', channels: removed });
			this.#closeWhenIdle();
		};
	}

	/**
	 * Отправить сообщение в соединение (chat.send, chat.read). false — соединения нет: сообщение
	 * не ушло, вызывающий показывает ошибку.
	 */
	send(message: object): boolean {
		if (this.#socket?.readyState !== OPEN) return false;
		this.#socket.send(JSON.stringify(message));
		return true;
	}

	/** Слушать ответы сервера на send (chat.sent, chat.read_saved, error). Возвращает отписку. */
	onReply(listener: (message: ReplyMessage) => void): () => void {
		this.#replies.add(listener);
		return () => this.#replies.delete(listener);
	}

	get status(): RealtimeStatus {
		return this.#status;
	}

	/** Следить за статусом соединения. Возвращает отписку. */
	onStatus(listener: (status: RealtimeStatus) => void): () => void {
		this.#statusListeners.add(listener);
		return () => this.#statusListeners.delete(listener);
	}

	/** После offline/replaced: попробовать снова (кнопка «Повторить» / «Подключиться здесь»). */
	retry() {
		this.#deps.clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = null;
		this.#attempt = 0;
		if (this.#status === 'offline' || this.#status === 'replaced') this.#setStatus('idle');
		this.#ensureSocket();
	}

	/**
	 * Вошли — auth в уже открытое соединение (сокет вход не открывает: он нужен только чату);
	 * вышли — соединение закрывается, с подписками откроется гостевое.
	 */
	setAuth(authed: boolean) {
		if (authed === this.#wantAuth) return;
		this.#wantAuth = authed;
		if (authed) {
			if (this.#socket?.readyState === OPEN) void this.#auth();
		} else {
			this.#clearRenew();
			this.#restart();
		}
	}

	/** Закрыть соединение (тесты, выход со страницы). */
	close() {
		this.#deps.clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = null;
		this.#deps.clearTimeout(this.#idleTimer);
		this.#idleTimer = null;
		this.#clearRenew();
		const socket = this.#socket;
		this.#socket = null;
		if (socket) {
			socket.onclose = null;
			socket.close();
		}
		if (this.#status === 'connecting' || this.#status === 'open') this.#setStatus('idle');
	}

	/**
	 * Подписок не осталось — закрыть через IDLE_CLOSE_MS (и гостю, и вошедшему): каждое открытое
	 * соединение держит память на сервере. Заодно сбросить offline/replaced: следующее открытие
	 * чата подключается заново.
	 */
	#closeWhenIdle() {
		if (this.#subs.size || this.#idleTimer) return;
		this.#idleTimer = this.#deps.setTimeout(() => {
			this.#idleTimer = null;
			if (this.#subs.size) return;
			this.close();
			this.#attempt = 0;
			this.#setStatus('idle');
		}, IDLE_CLOSE_MS);
	}

	#setStatus(status: RealtimeStatus) {
		if (status === this.#status) return;
		this.#status = status;
		for (const listener of this.#statusListeners) listener(status);
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
		if (!this.#subs.size) return;
		if (this.#status === 'offline' || this.#status === 'replaced') return;
		const socket = this.#deps.connect();
		this.#socket = socket;
		this.#setStatus('connecting');
		socket.onopen = () => void this.#onOpen();
		socket.onmessage = (event) => this.#onMessage(event.data);
		socket.onclose = (event) => this.#onClose(socket, event?.code);
	}

	#restart() {
		this.close();
		this.#ensureSocket();
	}

	async #onOpen() {
		this.#attempt = 0;
		this.#setStatus('open');
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

	#onClose(socket: SocketLike, code?: number) {
		if (socket !== this.#socket) return;
		this.#socket = null;
		this.#clearRenew();
		// Тот же пользователь открыл чат в другом окне или устройстве: не отбираем сокет обратно.
		if (code === CLOSE_REPLACED) return this.#setStatus('replaced');
		if (this.#attempt >= MAX_ATTEMPTS) return this.#setStatus('offline');
		this.#setStatus('connecting');
		const jitter = 0.5 + (this.#deps.random?.() ?? Math.random());
		const delay = Math.round(backoff(this.#attempt++) * Math.min(jitter, 1.5));
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
			case 'chat.sent':
			case 'chat.read_saved':
			case 'error':
				for (const listener of this.#replies) listener(message);
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
