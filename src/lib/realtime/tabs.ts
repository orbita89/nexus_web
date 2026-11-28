// Один WebSocket на браузер, сколько бы вкладок ни было открыто.
//
// - Сокет держит «главная» вкладка — владелец Web Lock `nexus-ws`. Lock просит только вкладка,
//   которой сокет нужен сама (есть подписки — открыта панель чата); остальные ждут в очереди.
// - Вкладки сообщают главной свои каналы по BroadcastChannel, главная подписывает их объединение
//   и рассылает каждое событие, ответ сервера и статус всем вкладкам; send() других вкладок идёт
//   через неё же.
// - Главную закрыли — браузер сам отдаёт lock следующей из очереди, та подключается, и все
//   получают resync (события за паузу перечитываются).
// - Вкладка в фоне дольше HIDDEN_SUSPEND_MS снимает свои подписки (для сервера её нет); вернулась —
//   подписки обратно и resync. Скрыты все — сокет закрывается.
// - Нет Web Locks или BroadcastChannel (старый браузер) — каждая вкладка сама себе главная.
//
// Без Svelte и без браузерных глобалов: всё внешнее приходит в TabDeps (тесты — tabs.spec.ts).
import type { RealtimeEvent, RealtimeStatus, ReplyMessage } from './client.ts';
import { Realtime } from './client.ts';

/** Вкладка в фоне дольше — её подписки снимаются. */
export const HIDDEN_SUSPEND_MS = 60_000;
/** Как часто вкладка подтверждает главной свои каналы. */
export const NEED_HEARTBEAT_MS = 30_000;
/** Вкладка молчит дольше (закрылась без pagehide) — главная забывает её каналы. */
export const NEED_TTL_MS = 75_000;

export interface ChannelLike {
	postMessage(message: unknown): void;
	onmessage: ((event: { data: unknown }) => void) | null;
	close(): void;
}

export interface TabDeps {
	/** Ядро сокета; создаётся только в главной вкладке. */
	core(): Realtime;
	/** null — нет BroadcastChannel/Web Locks: вкладка работает одна. */
	channel(): ChannelLike | null;
	/** Взять lock: onGranted — вкладка стала главной, держит lock, пока его промис не завершён. */
	lock: ((onGranted: () => Promise<void>, signal: AbortSignal) => Promise<unknown>) | null;
	tabId: string;
	now(): number;
	setTimeout(fn: () => void, ms: number): unknown;
	clearTimeout(id: unknown): void;
	setInterval(fn: () => void, ms: number): unknown;
	clearInterval(id: unknown): void;
}

interface Subscription {
	channels: Set<string> | null;
	onEvent: (event: RealtimeEvent) => void;
	onResync?: () => void;
}

/** Что нужно вкладке: события «на всё» и/или каналы. */
interface Need {
	all: boolean;
	channels: string[];
}

type Wire =
	| { k: 'need'; tab: string; all: boolean; channels: string[] }
	| { k: 'hello' }
	| { k: 'event'; event: RealtimeEvent }
	| { k: 'resync' }
	| { k: 'reply'; message: ReplyMessage }
	| { k: 'status'; status: RealtimeStatus }
	| { k: 'send'; message: object }
	| { k: 'retry' };

const EMPTY: Need = { all: false, channels: [] };
const isEmpty = (n: Need) => !n.all && !n.channels.length;

export class TabRealtime {
	#deps: TabDeps;
	#bc: ChannelLike | null;
	#subs = new Set<Subscription>();
	#replies = new Set<(message: ReplyMessage) => void>();
	#statusListeners = new Set<(status: RealtimeStatus) => void>();
	#status: RealtimeStatus = 'idle';
	#authed = false;
	#suspended = false;
	#hiddenTimer: unknown = null;
	#heartbeat: unknown = null;

	// Очередь за lock.
	#lockAbort: AbortController | null = null;
	// Главная вкладка.
	#core: Realtime | null = null;
	#release: (() => void) | null = null;
	#coreOff: (() => void)[] = [];
	/** Вкладка → её каналы и когда последний раз отзывалась (у главной, включая себя). */
	#remote = new Map<string, { need: Need; seen: number; off: (() => void) | null }>();
	#master: (() => void) | null = null;
	/** Нас уже обслуживала другая главная: после своего подключения — resync (могли пропустить). */
	#sawLeader = false;

	constructor(deps: TabDeps) {
		this.#deps = deps;
		this.#bc = deps.lock ? deps.channel() : null;
		if (this.#bc) this.#bc.onmessage = (event) => this.#onWire(event.data as Wire);
	}

	get status(): RealtimeStatus {
		return this.#status;
	}

	get leader(): boolean {
		return !!this.#core;
	}

	subscribe(
		channels: string[] | null,
		onEvent: (event: RealtimeEvent) => void,
		onResync?: () => void
	): () => void {
		const sub: Subscription = { channels: channels && new Set(channels), onEvent, onResync };
		this.#subs.add(sub);
		this.#needChanged();
		return () => {
			if (this.#subs.delete(sub)) this.#needChanged();
		};
	}

	/** false — соединения нет (сообщение не ушло). */
	send(message: object): boolean {
		if (this.#core) return this.#core.send(message);
		if (!this.#bc || this.#status !== 'open') return false;
		this.#post({ k: 'send', message });
		return true;
	}

	onReply(listener: (message: ReplyMessage) => void): () => void {
		this.#replies.add(listener);
		return () => this.#replies.delete(listener);
	}

	onStatus(listener: (status: RealtimeStatus) => void): () => void {
		this.#statusListeners.add(listener);
		return () => this.#statusListeners.delete(listener);
	}

	setAuth(authed: boolean) {
		this.#authed = authed;
		this.#core?.setAuth(authed);
	}

	retry() {
		if (this.#core) this.#core.retry();
		else this.#post({ k: 'retry' });
	}

	/** visibilitychange: в фоне дольше HIDDEN_SUSPEND_MS — подписки снимаются. */
	setVisible(visible: boolean) {
		this.#deps.clearTimeout(this.#hiddenTimer);
		this.#hiddenTimer = null;
		if (!visible) {
			this.#hiddenTimer = this.#deps.setTimeout(() => {
				this.#hiddenTimer = null;
				this.#suspended = true;
				this.#needChanged();
			}, HIDDEN_SUSPEND_MS);
			return;
		}
		if (!this.#suspended) return;
		this.#suspended = false;
		this.#needChanged();
		// Пока спали, события сюда не шли — перечитать.
		for (const sub of this.#subs) sub.onResync?.();
	}

	/** pagehide: сказать главной, что каналы этой вкладки больше не нужны. */
	leave() {
		if (!this.#core) this.#post({ k: 'need', tab: this.#deps.tabId, ...EMPTY });
	}

	// --- своя потребность ---

	#need(): Need {
		if (this.#suspended) return EMPTY;
		let all = false;
		const channels = new Set<string>();
		for (const sub of this.#subs) {
			if (!sub.channels) all = true;
			else for (const c of sub.channels) channels.add(c);
		}
		return { all, channels: [...channels] };
	}

	#needChanged() {
		const need = this.#need();
		if (!this.#deps.lock) {
			// Одна вкладка: сразу своя главная.
			if (!isEmpty(need) && !this.#core) void this.#becomeLeader();
			if (this.#core) this.#setNeed(this.#deps.tabId, need);
			return;
		}
		if (this.#core) {
			this.#setNeed(this.#deps.tabId, need);
		} else {
			this.#post({ k: 'need', tab: this.#deps.tabId, ...need });
			if (isEmpty(need)) {
				this.#lockAbort?.abort();
				this.#lockAbort = null;
			} else if (!this.#lockAbort) {
				this.#requestLock();
			}
		}
		this.#syncHeartbeat(need);
	}

	#syncHeartbeat(need: Need) {
		const want = !isEmpty(need) && !this.#core && !!this.#bc;
		if (want && !this.#heartbeat) {
			this.#heartbeat = this.#deps.setInterval(
				() => this.#post({ k: 'need', tab: this.#deps.tabId, ...this.#need() }),
				NEED_HEARTBEAT_MS
			);
		} else if (!want && this.#heartbeat) {
			this.#deps.clearInterval(this.#heartbeat);
			this.#heartbeat = null;
		}
	}

	#requestLock() {
		const abort = new AbortController();
		this.#lockAbort = abort;
		this.#deps.lock!(() => this.#becomeLeader(), abort.signal).catch(() => {
			// Отменили, пока ждали в очереди — нормально.
		});
	}

	// --- главная вкладка ---

	/** Держит lock, пока не отпустим (#release). */
	#becomeLeader(): Promise<void> {
		this.#lockAbort = null;
		const core = this.#deps.core();
		this.#core = core;
		core.setAuth(this.#authed);
		this.#coreOff = [
			core.onReply((message) => {
				this.#emitReply(message);
				this.#post({ k: 'reply', message });
			}),
			core.onStatus((status) => {
				this.#setStatus(status);
				this.#post({ k: 'status', status });
				if (status === 'open' && this.#sawLeader) {
					this.#sawLeader = false;
					this.#resync();
					this.#post({ k: 'resync' });
				}
			})
		];
		this.#syncHeartbeat(EMPTY);
		const held = new Promise<void>((resolve) => (this.#release = resolve));
		this.#remote.clear();
		this.#setNeed(this.#deps.tabId, this.#need());
		// Остальные вкладки — назовите свои каналы.
		this.#post({ k: 'hello' });
		return held;
	}

	#setNeed(tab: string, need: Need) {
		const core = this.#core!;
		const prev = this.#remote.get(tab);
		const same =
			prev &&
			prev.need.all === need.all &&
			prev.need.channels.length === need.channels.length &&
			prev.need.channels.every((c) => need.channels.includes(c));
		if (same) {
			prev.seen = this.#deps.now();
			return;
		}
		prev?.off?.();
		if (isEmpty(need)) this.#remote.delete(tab);
		else
			this.#remote.set(tab, {
				need,
				seen: this.#deps.now(),
				// Только счётчики каналов на сервере; доставка — общей подпиской #master.
				off: need.channels.length ? core.subscribe(need.channels, () => {}) : null
			});
		this.#syncMaster();
	}

	/** Общая подписка «на всё», пока хоть одной вкладке что-то нужно; нет — сокет закроется. */
	#syncMaster() {
		this.#pruneDead();
		const needed = this.#remote.size > 0;
		if (needed && !this.#master) {
			this.#master = this.#core!.subscribe(
				null,
				(event) => {
					this.#dispatch(event);
					this.#post({ k: 'event', event });
				},
				() => {
					this.#resync();
					this.#post({ k: 'resync' });
				}
			);
		} else if (!needed && this.#master) {
			this.#master();
			this.#master = null;
			// Сокет закроется сам через IDLE_CLOSE_MS. Своих подписок нет — отдать lock: со
			// следующей подпиской вкладка встанет в очередь заново.
			if (isEmpty(this.#need())) this.#stepDown();
		}
	}

	#pruneDead() {
		const now = this.#deps.now();
		for (const [tab, entry] of this.#remote) {
			if (tab !== this.#deps.tabId && now - entry.seen > NEED_TTL_MS) {
				entry.off?.();
				this.#remote.delete(tab);
			}
		}
	}

	#stepDown() {
		const core = this.#core;
		if (!core) return;
		for (const off of this.#coreOff) off();
		this.#coreOff = [];
		for (const entry of this.#remote.values()) entry.off?.();
		this.#remote.clear();
		core.close();
		this.#core = null;
		this.#setStatus('idle');
		this.#post({ k: 'status', status: 'idle' });
		this.#release?.();
		this.#release = null;
	}

	// --- провод между вкладками ---

	#post(message: Wire) {
		this.#bc?.postMessage(message);
	}

	#onWire(message: Wire) {
		switch (message.k) {
			case 'need':
				if (!this.#core) break;
				this.#setNeed(message.tab, message);
				// Новая вкладка ещё не знает, есть ли соединение (главная могла уже отдать lock).
				if (this.#core) this.#post({ k: 'status', status: this.#core.status });
				break;
			case 'hello':
				if (!this.#core) {
					const need = this.#need();
					if (!isEmpty(need)) this.#post({ k: 'need', tab: this.#deps.tabId, ...need });
				}
				break;
			case 'send':
				this.#core?.send(message.message);
				break;
			case 'retry':
				this.#core?.retry();
				break;
			case 'event':
				if (!this.#core) this.#dispatch(message.event);
				break;
			case 'resync':
				if (!this.#core) this.#resync();
				break;
			case 'reply':
				if (!this.#core) this.#emitReply(message.message);
				break;
			case 'status':
				if (this.#core) break;
				if (message.status === 'open') this.#sawLeader = true;
				this.#setStatus(message.status);
				break;
		}
	}

	#dispatch(event: RealtimeEvent) {
		if (this.#suspended) return;
		for (const sub of this.#subs) {
			if (!sub.channels || event.channels.some((c) => sub.channels!.has(c))) sub.onEvent(event);
		}
	}

	#resync() {
		if (this.#suspended) return;
		for (const sub of this.#subs) sub.onResync?.();
	}

	#emitReply(message: ReplyMessage) {
		for (const listener of this.#replies) listener(message);
	}

	#setStatus(status: RealtimeStatus) {
		if (status === this.#status) return;
		this.#status = status;
		for (const listener of this.#statusListeners) listener(status);
	}
}
