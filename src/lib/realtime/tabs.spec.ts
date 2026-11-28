import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_CLOSE_MS, Realtime, type SocketLike } from './client';
import { HIDDEN_SUSPEND_MS, TabRealtime, type ChannelLike, type TabDeps } from './tabs';

class FakeSocket implements SocketLike {
	readyState = 0;
	sent: Record<string, unknown>[] = [];
	onopen: (() => void) | null = null;
	onclose: ((event?: { code?: number }) => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	send(data: string) {
		this.sent.push(JSON.parse(data));
	}
	close() {
		this.readyState = 3;
	}
	open() {
		this.readyState = 1;
		this.onopen?.();
	}
	receive(message: object) {
		this.onmessage?.({ data: JSON.stringify(message) });
	}
}

/** BroadcastChannel: сообщение получают все, кроме отправителя (асинхронно, как в браузере). */
class Bus {
	members = new Set<FakeChannel>();
}
class FakeChannel implements ChannelLike {
	onmessage: ((event: { data: unknown }) => void) | null = null;
	constructor(private bus: Bus) {
		bus.members.add(this);
	}
	postMessage(message: unknown) {
		const data = structuredClone(message);
		for (const m of this.bus.members) if (m !== this) queueMicrotask(() => m.onmessage?.({ data }));
	}
	close() {
		this.bus.members.delete(this);
	}
}

/** Web Lock: одна держит, остальные в очереди; отмена через signal. */
class Lock {
	#held = false;
	#queue: { granted: () => Promise<void>; signal: AbortSignal; done: () => void }[] = [];
	request = (granted: () => Promise<void>, signal: AbortSignal) =>
		new Promise<void>((resolve, reject) => {
			signal.addEventListener('abort', () => {
				this.#queue = this.#queue.filter((q) => q.signal !== signal);
				reject(new Error('aborted'));
			});
			this.#queue.push({ granted, signal, done: resolve });
			this.#next();
		});
	/** Вкладку закрыли: lock держателя отпускается. */
	crash!: () => void;
	#next() {
		if (this.#held) return;
		const q = this.#queue.shift();
		if (!q) return;
		this.#held = true;
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			this.#held = false;
			q.done();
			this.#next();
		};
		this.crash = finish;
		void q.granted().then(finish);
	}
}

let sockets: FakeSocket[];
let bus: Bus;
let lock: Lock;
let n: number;

function tab(shared = true) {
	const deps: TabDeps = {
		core: () =>
			new Realtime({
				connect: () => {
					const s = new FakeSocket();
					sockets.push(s);
					return s;
				},
				token: async () => 't',
				now: () => Date.now(),
				setTimeout: (fn, ms) => setTimeout(fn, ms),
				clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
				random: () => 0.5
			}),
		channel: () => new FakeChannel(bus),
		lock: shared ? lock.request : null,
		tabId: `tab-${n++}`,
		now: () => Date.now(),
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
		setInterval: (fn, ms) => setInterval(fn, ms),
		clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>)
	};
	return new TabRealtime(deps);
}

const flush = () => vi.advanceTimersByTimeAsync(0);
const event = (channels: string[]) => ({
	type: 'event',
	event: 'chat.message.created',
	channels,
	data: {}
});

beforeEach(() => {
	vi.useFakeTimers();
	sockets = [];
	bus = new Bus();
	lock = new Lock();
	n = 0;
});
afterEach(() => vi.useRealTimers());

describe('один сокет на браузер', () => {
	it('без подписок сокета нет ни в одной вкладке', async () => {
		const a = tab();
		tab();
		a.setAuth(true);
		await flush();
		expect(sockets).toHaveLength(0);
	});

	it('две вкладки с чатом — один сокет; события и статус доходят до обеих; send — через главную', async () => {
		const a = tab();
		const b = tab();
		const gotA = vi.fn();
		const gotB = vi.fn();
		a.subscribe(null, gotA);
		await flush();
		b.subscribe(['room:x'], gotB);
		await flush();
		expect(sockets).toHaveLength(1);
		expect(a.leader).toBe(true);
		expect(b.leader).toBe(false);

		sockets[0].open();
		await flush();
		expect(sockets[0].sent).toContainEqual({ type: 'subscribe', channels: ['room:x'] });
		expect(b.status).toBe('open');

		sockets[0].receive(event(['room:x']));
		await flush();
		expect(gotA).toHaveBeenCalledTimes(1);
		expect(gotB).toHaveBeenCalledTimes(1);
		// Чужой канал вкладке B не нужен.
		sockets[0].receive(event(['room:y']));
		await flush();
		expect(gotB).toHaveBeenCalledTimes(1);

		expect(b.send({ type: 'chat.send', body: 'привет' })).toBe(true);
		await flush();
		expect(sockets[0].sent.at(-1)).toEqual({ type: 'chat.send', body: 'привет' });
	});

	it('главную закрыли — сокет открывает следующая, остальным resync', async () => {
		const a = tab();
		const b = tab();
		a.subscribe(null, () => {});
		await flush();
		const resync = vi.fn();
		b.subscribe(null, () => {}, resync);
		await flush();
		sockets[0].open();
		await flush();

		lock.crash();
		await flush();
		expect(b.leader).toBe(true);
		expect(sockets).toHaveLength(2);
		sockets[1].open();
		await flush();
		expect(resync).toHaveBeenCalledTimes(1);
	});

	it('чат закрыли во всех вкладках — сокет закрывается через IDLE_CLOSE_MS, lock отдан', async () => {
		const a = tab();
		const b = tab();
		const offA = a.subscribe(null, () => {});
		await flush();
		const offB = b.subscribe(['room:x'], () => {});
		await flush();
		sockets[0].open();
		await flush();
		offA();
		await vi.advanceTimersByTimeAsync(IDLE_CLOSE_MS);
		// B ещё нужен — сокет живёт.
		expect(sockets[0].readyState).toBe(1);
		offB();
		await flush();
		await vi.advanceTimersByTimeAsync(IDLE_CLOSE_MS);
		expect(sockets[0].readyState).toBe(3);
		expect(a.leader).toBe(false);
	});

	it('вкладка в фоне дольше минуты снимает подписки; вернулась — обратно и resync', async () => {
		const a = tab();
		const resync = vi.fn();
		a.subscribe(null, () => {}, resync);
		await flush();
		sockets[0].open();
		await flush();
		a.setVisible(false);
		await vi.advanceTimersByTimeAsync(HIDDEN_SUSPEND_MS + IDLE_CLOSE_MS);
		expect(sockets[0].readyState).toBe(3);

		a.setVisible(true);
		await flush();
		expect(sockets).toHaveLength(2);
		expect(resync).toHaveBeenCalledTimes(1);
	});

	it('без Web Locks вкладка работает одна', async () => {
		const a = tab(false);
		a.subscribe(null, () => {});
		await flush();
		expect(a.leader).toBe(true);
		expect(sockets).toHaveLength(1);
	});
});
