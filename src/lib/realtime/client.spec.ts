import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoff, Realtime, type SocketLike } from './client';

class FakeSocket implements SocketLike {
	readyState = 0;
	sent: Record<string, unknown>[] = [];
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
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
	drop() {
		this.readyState = 3;
		this.onclose?.();
	}
	receive(message: object) {
		this.onmessage?.({ data: JSON.stringify(message) });
	}
}

let sockets: FakeSocket[];
let token: string | null;

function client() {
	return new Realtime({
		connect: () => {
			const s = new FakeSocket();
			sockets.push(s);
			return s;
		},
		token: async () => token,
		now: () => Date.now(),
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>)
	});
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
	vi.useFakeTimers();
	sockets = [];
	token = null;
});
afterEach(() => vi.useRealTimers());

describe('backoff', () => {
	it('1, 2, 4, … до 30 секунд', () => {
		expect([0, 1, 2, 3, 4, 5, 6, 10].map(backoff)).toEqual([
			1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000
		]);
	});
});

describe('подписки', () => {
	it('соединение открывается при первой подписке; каналы уходят после open', async () => {
		const rt = client();
		expect(sockets).toHaveLength(0);
		rt.subscribe(['thread:1'], () => {});
		expect(sockets).toHaveLength(1);
		sockets[0].open();
		await flush();
		expect(sockets[0].sent).toEqual([{ type: 'subscribe', channels: ['thread:1'] }]);
	});

	it('счётчик: второй подписчик того же канала не шлёт subscribe, отписка — по последнему', async () => {
		const rt = client();
		const a = rt.subscribe(['thread:1'], () => {});
		sockets[0].open();
		await flush();
		const b = rt.subscribe(['thread:1', 'entity:dune-2021'], () => {});
		a();
		b();
		expect(sockets[0].sent).toEqual([
			{ type: 'subscribe', channels: ['thread:1'] },
			{ type: 'subscribe', channels: ['entity:dune-2021'] },
			{ type: 'unsubscribe', channels: ['thread:1', 'entity:dune-2021'] }
		]);
	});

	it('user:me сервер подписывает сам — в subscribe не уходит', async () => {
		const rt = client();
		rt.subscribe(['user:me'], () => {});
		sockets[0].open();
		await flush();
		expect(sockets[0].sent).toEqual([]);
	});

	it('событие — подписчикам с совпавшим каналом и подписчикам «на всё», один раз', async () => {
		const rt = client();
		const thread = vi.fn();
		const other = vi.fn();
		const all = vi.fn();
		rt.subscribe(['thread:1', 'entity:dune-2021'], thread);
		rt.subscribe(['thread:2'], other);
		rt.subscribe(null, all);
		sockets[0].open();
		await flush();
		sockets[0].receive({
			type: 'event',
			event: 'post.created',
			channels: ['thread:1', 'entity:dune-2021'],
			data: { post_id: 'p' }
		});
		expect(thread).toHaveBeenCalledTimes(1);
		expect(thread.mock.calls[0][0]).toMatchObject({
			event: 'post.created',
			data: { post_id: 'p' }
		});
		expect(other).not.toHaveBeenCalled();
		expect(all).toHaveBeenCalledTimes(1);
	});
});

describe('обрыв и lagged', () => {
	it('переподключение с паузой, подписки заново, подписчикам — resync', async () => {
		const rt = client();
		const resync = vi.fn();
		rt.subscribe(['thread:1'], () => {}, resync);
		sockets[0].open();
		await flush();

		sockets[0].drop();
		await vi.advanceTimersByTimeAsync(999);
		expect(sockets).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(sockets).toHaveLength(2);
		sockets[1].drop();
		await vi.advanceTimersByTimeAsync(2000);
		expect(sockets).toHaveLength(3);

		sockets[2].open();
		await flush();
		expect(sockets[2].sent).toEqual([{ type: 'subscribe', channels: ['thread:1'] }]);
		expect(resync).toHaveBeenCalledTimes(1);

		// После удачного подключения пауза снова с 1 секунды.
		sockets[2].drop();
		await vi.advanceTimersByTimeAsync(1000);
		expect(sockets).toHaveLength(4);
	});

	it('lagged — resync', async () => {
		const rt = client();
		const resync = vi.fn();
		rt.subscribe(['thread:1'], () => {}, resync);
		sockets[0].open();
		await flush();
		sockets[0].receive({ type: 'lagged', missed: 17 });
		expect(resync).toHaveBeenCalledTimes(1);
	});
});

describe('вход', () => {
	it('вошли — auth, затем подписки; за 25 с до истечения — auth снова', async () => {
		token = 'access-1';
		const rt = client();
		rt.subscribe(['thread:1'], () => {});
		rt.setAuth(true);
		sockets[0].open();
		await flush();
		expect(sockets[0].sent).toEqual([
			{ type: 'auth', token: 'access-1' },
			{ type: 'subscribe', channels: ['thread:1'] }
		]);

		const expires = new Date(Date.now() + 15 * 60_000).toISOString();
		sockets[0].receive({ type: 'authenticated', expires_at: expires, channels: ['user:me'] });
		token = 'access-2';
		await vi.advanceTimersByTimeAsync(15 * 60_000 - 25_001);
		expect(sockets[0].sent).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(sockets[0].sent.at(-1)).toEqual({ type: 'auth', token: 'access-2' });
	});

	it('вход после открытия — auth в то же соединение; выход — новое гостевое', async () => {
		token = 'access-1';
		const rt = client();
		rt.subscribe(['thread:1'], () => {});
		sockets[0].open();
		await flush();
		rt.setAuth(true);
		await flush();
		expect(sockets[0].sent.at(-1)).toEqual({ type: 'auth', token: 'access-1' });

		rt.setAuth(false);
		expect(sockets).toHaveLength(2);
		sockets[1].open();
		await flush();
		expect(sockets[1].sent).toEqual([{ type: 'subscribe', channels: ['thread:1'] }]);
	});

	it('без подписок и без входа соединение не открывается', () => {
		const rt = client();
		rt.setAuth(false);
		expect(sockets).toHaveLength(0);
	});
});
