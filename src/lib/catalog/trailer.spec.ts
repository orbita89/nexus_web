import { describe, expect, it } from 'vitest';
import {
	backgroundUrl,
	embedUrl,
	playerCommand,
	nextIndex,
	playerSignal,
	shouldFallback,
	sourceLabel,
	startIndex,
	trailerSources,
	type TrailerSource
} from './trailer';

const yt: TrailerSource = { provider: 'youtube', id: 'n9xhJrPXop4' };
const ru: TrailerSource = { provider: 'rutube', id: '0ab1fc1e47f2e9b89e9e59d9db36f2b4' };

describe('trailerSources', () => {
	it('фильм, сериал, игра — источники по порядку', () => {
		expect(trailerSources({ kind: 'movie', metadata: { trailers: [yt, ru] } })).toEqual([yt, ru]);
		expect(trailerSources({ kind: 'series', metadata: { trailers: [ru, yt] } })).toEqual([ru, yt]);
		expect(trailerSources({ kind: 'game', metadata: { trailers: [yt] } })).toEqual([yt]);
	});

	it('книга и пустая metadata — []', () => {
		expect(trailerSources({ kind: 'book', metadata: { trailers: [yt] } as never })).toEqual([]);
		expect(trailerSources({ kind: 'movie', metadata: {} })).toEqual([]);
		expect(trailerSources({ kind: 'movie', metadata: { trailers: null } })).toEqual([]);
	});

	it('неизвестный провайдер и кривой id отброшены, порядок сохранён', () => {
		const trailers = [
			{ provider: 'vimeo', id: '123456' },
			{ provider: 'youtube', id: 'short' },
			{ provider: 'youtube', id: 'n9xhJrPXop4"><script>' },
			ru,
			{ provider: 'rutube', id: '0AB1FC1E47F2E9B89E9E59D9DB36F2B4' },
			yt,
			null
		];
		expect(trailerSources({ kind: 'movie', metadata: { trailers } as never })).toEqual([ru, yt]);
	});
});

describe('embedUrl', () => {
	it('youtube-nocookie с автозапуском и событиями для нашего origin', () => {
		const url = new URL(embedUrl(yt, 'https://nexus.example'));
		expect(url.origin + url.pathname).toBe('https://www.youtube-nocookie.com/embed/n9xhJrPXop4');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			autoplay: '1',
			rel: '0',
			enablejsapi: '1',
			origin: 'https://nexus.example'
		});
	});

	it('rutube', () => {
		expect(embedUrl(ru, 'https://nexus.example')).toBe(
			'https://rutube.ru/play/embed/0ab1fc1e47f2e9b89e9e59d9db36f2b4?autoplay=1'
		);
	});
});

describe('фоновый плеер', () => {
	it('YouTube: без звука, без управления, по кругу', () => {
		const url = new URL(backgroundUrl(yt, 'https://nexus.example'));
		expect(url.origin + url.pathname).toBe('https://www.youtube-nocookie.com/embed/n9xhJrPXop4');
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			autoplay: '1',
			mute: '1',
			controls: '0',
			loop: '1',
			playlist: 'n9xhJrPXop4',
			playsinline: '1',
			enablejsapi: '1',
			origin: 'https://nexus.example'
		});
	});

	it('Rutube: без звука', () => {
		expect(backgroundUrl(ru, 'https://nexus.example')).toBe(
			'https://rutube.ru/play/embed/0ab1fc1e47f2e9b89e9e59d9db36f2b4?autoplay=1&mute=1'
		);
	});

	it('команды плееру', () => {
		expect(playerCommand('youtube', 'unmute').map((m) => JSON.parse(m).func)).toEqual(['unMute']);
		expect(playerCommand('youtube', 'restart').map((m) => JSON.parse(m).func)).toEqual([
			'seekTo',
			'playVideo'
		]);
		expect(playerCommand('rutube', 'mute').map((m) => JSON.parse(m).type)).toEqual(['player:mute']);
		expect(playerCommand('rutube', 'restart').map((m) => JSON.parse(m))).toEqual([
			{ type: 'player:setCurrentTime', data: { time: 0 } },
			{ type: 'player:play', data: {} }
		]);
	});
});

describe('выбор источника', () => {
	it('стартовый: запомненный провайдер, иначе первый', () => {
		expect(startIndex([yt, ru], 'rutube')).toBe(1);
		expect(startIndex([yt, ru], 'youtube')).toBe(0);
		expect(startIndex([yt, ru], null)).toBe(0);
		expect(startIndex([yt], 'rutube')).toBe(0);
	});

	it('следующий: первый не опробованный по приоритету', () => {
		expect(nextIndex(2, [0])).toBe(1);
		expect(nextIndex(3, [1])).toBe(0);
		expect(nextIndex(2, [0, 1])).toBeNull();
	});

	it('подписи', () => {
		expect(sourceLabel([yt, ru], 0)).toBe('YouTube');
		const yt2 = { provider: 'youtube' as const, id: 'Way9Dexny3w' };
		expect(sourceLabel([yt, yt2, ru], 1)).toBe('YouTube 2');
	});

	it('таймаут: переключаемся, если плеер молчит или завис на загрузке', () => {
		expect(shouldFallback({ ready: false, buffering: false, playing: false })).toBe(true);
		expect(shouldFallback({ ready: true, buffering: true, playing: false })).toBe(true);
		// плеер загрузился, автозапуск не дали — ждём, пока зритель нажмёт ▶
		expect(shouldFallback({ ready: true, buffering: false, playing: false })).toBe(false);
		expect(shouldFallback({ ready: true, buffering: true, playing: true })).toBe(false);
	});

	it('таймаут на фоне: нажать ▶ нельзя — переключаемся, пока не играет', () => {
		const background = { background: true };
		expect(shouldFallback({ ready: true, buffering: false, playing: false }, background)).toBe(
			true
		);
		expect(shouldFallback({ ready: false, buffering: false, playing: false }, background)).toBe(
			true
		);
		expect(shouldFallback({ ready: true, buffering: true, playing: true }, background)).toBe(false);
	});
});

describe('playerSignal', () => {
	const YT = 'https://www.youtube-nocookie.com';
	const RU = 'https://rutube.ru';

	it('YouTube: состояния из onStateChange и infoDelivery, ошибка', () => {
		const ytMsg = (o: object) => JSON.stringify(o);
		expect(playerSignal('youtube', YT, ytMsg({ event: 'onReady' }))).toBe('loaded');
		expect(playerSignal('youtube', YT, ytMsg({ event: 'initialDelivery', info: {} }))).toBe(
			'ready'
		);
		expect(playerSignal('youtube', YT, ytMsg({ event: 'onStateChange', info: 3 }))).toBe(
			'buffering'
		);
		expect(playerSignal('youtube', YT, ytMsg({ event: 'onStateChange', info: 1 }))).toBe('playing');
		expect(
			playerSignal('youtube', YT, ytMsg({ event: 'infoDelivery', info: { playerState: 1 } }))
		).toBe('playing');
		expect(
			playerSignal('youtube', YT, ytMsg({ event: 'infoDelivery', info: { currentTime: 3 } }))
		).toBe('ready');
		expect(playerSignal('youtube', YT, ytMsg({ event: 'onStateChange', info: 0 }))).toBe('ended');
		expect(playerSignal('youtube', YT, ytMsg({ event: 'onError', info: 150 }))).toBe('error');
	});

	it('Rutube: playing, другие состояния, ошибка; строка и объект', () => {
		const playing = { type: 'player:changeState', data: { state: 'playing' } };
		expect(playerSignal('rutube', RU, JSON.stringify(playing))).toBe('playing');
		expect(playerSignal('rutube', RU, playing)).toBe('playing');
		expect(
			playerSignal('rutube', RU, { type: 'player:changeState', data: { state: 'paused' } })
		).toBe('ready');
		expect(
			playerSignal('rutube', RU, { type: 'player:changeState', data: { state: 'buffering' } })
		).toBe('buffering');
		expect(playerSignal('rutube', RU, { type: 'player:ready' })).toBe('loaded');
		expect(playerSignal('rutube', RU, { type: 'player:playComplete' })).toBe('ended');
		expect(playerSignal('rutube', RU, { type: 'player:error' })).toBe('error');
	});

	it('чужой origin, мусор и чужие события — null', () => {
		const playing = JSON.stringify({ event: 'onStateChange', info: 1 });
		expect(playerSignal('youtube', 'https://evil.example', playing)).toBeNull();
		expect(playerSignal('youtube', RU, playing)).toBeNull();
		expect(
			playerSignal('rutube', YT, { type: 'player:changeState', data: { state: 'playing' } })
		).toBeNull();
		expect(playerSignal('youtube', YT, 'not json')).toBeNull();
		expect(playerSignal('youtube', YT, JSON.stringify({ event: 'other' }))).toBeNull();
		expect(playerSignal('rutube', RU, 42)).toBeNull();
	});
});
