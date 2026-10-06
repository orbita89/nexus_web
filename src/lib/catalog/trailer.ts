// Трейлеры: metadata.trailers у фильмов, сериалов и игр — источники по приоритету
// (YouTube, затем Rutube: YouTube заблокирован в части стран СНГ и в Китае). Адрес плеера строим
// сами по провайдеру и id — в iframe не попадает произвольный домен из БД.
//
// Какой источник работает у зрителя, видно только по самому плееру: превью i.ytimg.com в РФ
// часто грузятся, а видео — нет. Поэтому плеер стартует с autoplay, а события плеера
// (postMessage) говорят, пошло ли воспроизведение; нет — следующий источник.
import type {
	SchemaEntityKind,
	SchemaMetadata,
	SchemaTrailerProvider,
	SchemaTrailerSource
} from '#lib/api/generated/catalog.ts';

export type Provider = SchemaTrailerProvider;
export type TrailerSource = SchemaTrailerSource;

const ID_PATTERN: Record<Provider, RegExp> = {
	youtube: /^[A-Za-z0-9_-]{11}$/,
	rutube: /^[0-9a-f]{32}$/
};

export const PROVIDER_NAME: Record<Provider, string> = { youtube: 'YouTube', rutube: 'Rutube' };

/** Откуда приходят события плеера: только им верим в postMessage. */
export const PLAYER_ORIGIN: Record<Provider, string> = {
	youtube: 'https://www.youtube-nocookie.com',
	rutube: 'https://rutube.ru'
};

const WITH_TRAILERS: readonly SchemaEntityKind[] = ['movie', 'series', 'game'];

const isProvider = (p: unknown): p is Provider => typeof p === 'string' && p in ID_PATTERN;

/** Источники трейлера по приоритету. Неизвестный провайдер или кривой id — отброшены. */
export function trailerSources(entity: {
	kind: SchemaEntityKind;
	metadata: SchemaMetadata;
}): TrailerSource[] {
	if (!WITH_TRAILERS.includes(entity.kind)) return [];
	const raw = 'trailers' in entity.metadata ? entity.metadata.trailers : null;
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(s): s is TrailerSource =>
			!!s && isProvider(s.provider) && typeof s.id === 'string' && ID_PATTERN[s.provider].test(s.id)
	);
}

/** Адрес плеера с автозапуском. origin нужен YouTube, чтобы присылать события на нашу страницу. */
export function embedUrl(source: TrailerSource, origin: string): string {
	if (source.provider === 'youtube') {
		const q = new URLSearchParams({ autoplay: '1', rel: '0', enablejsapi: '1', origin });
		return `${PLAYER_ORIGIN.youtube}/embed/${source.id}?${q}`;
	}
	return `${PLAYER_ORIGIN.rutube}/play/embed/${source.id}?autoplay=1`;
}

/**
 * Адрес фонового плеера в шапке карточки, как у Okko: без звука (иначе браузер не даст
 * автозапуск), без элементов управления, по кругу. Звук, пауза и полный экран — нашими кнопками
 * через playerCommand().
 */
export function backgroundUrl(source: TrailerSource, origin: string): string {
	if (source.provider === 'youtube') {
		const q = new URLSearchParams({
			autoplay: '1',
			mute: '1',
			controls: '0',
			loop: '1',
			playlist: source.id,
			playsinline: '1',
			rel: '0',
			disablekb: '1',
			iv_load_policy: '3',
			enablejsapi: '1',
			origin
		});
		return `${PLAYER_ORIGIN.youtube}/embed/${source.id}?${q}`;
	}
	return `${PLAYER_ORIGIN.rutube}/play/embed/${source.id}?autoplay=1&mute=1`;
}

export type PlayerCommand = 'mute' | 'unmute' | 'play' | 'pause' | 'restart';

/** Сообщения плееру (postMessage) для команды: YouTube IFrame API или Rutube player API. */
export function playerCommand(provider: Provider, command: PlayerCommand): string[] {
	if (provider === 'youtube') {
		const yt = (func: string, args: unknown[] = []) =>
			JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' });
		const map: Record<PlayerCommand, string[]> = {
			mute: [yt('mute')],
			unmute: [yt('unMute')],
			play: [yt('playVideo')],
			pause: [yt('pauseVideo')],
			restart: [yt('seekTo', [0, true]), yt('playVideo')]
		};
		return map[command];
	}
	const ru = (type: string, data: object = {}) => JSON.stringify({ type, data });
	const map: Record<PlayerCommand, string[]> = {
		mute: [ru('player:mute')],
		unmute: [ru('player:unMute')],
		play: [ru('player:play')],
		pause: [ru('player:pause')],
		restart: [ru('player:setCurrentTime', { time: 0 }), ru('player:play')]
	};
	return map[command];
}

/** Отправить команду плееру в iframe (только его origin). */
export function sendCommand(
	frame: HTMLIFrameElement | undefined,
	provider: Provider,
	command: PlayerCommand
) {
	for (const message of playerCommand(provider, command)) {
		frame?.contentWindow?.postMessage(message, PLAYER_ORIGIN[provider]);
	}
}

/**
 * YouTube присылает события, только если страница «слушает»: рукопожатие IFrame API. Плеер может
 * быть ещё не готов к моменту load (медленная сеть), поэтому, как и официальная библиотека,
 * повторяем каждые 250 мс, пока плеер не ответит (не дольше 15 с). Возвращает функцию остановки.
 */
export function subscribe(frame: HTMLIFrameElement | undefined, provider: Provider): () => void {
	const target = frame?.contentWindow;
	if (provider !== 'youtube' || !target) return () => {};
	const post = (message: object) =>
		target.postMessage(
			JSON.stringify({ ...message, id: 1, channel: 'widget' }),
			PLAYER_ORIGIN.youtube
		);
	const handshake = () => {
		post({ event: 'listening' });
		post({ event: 'command', func: 'addEventListener', args: ['onStateChange'] });
		post({ event: 'command', func: 'addEventListener', args: ['onError'] });
	};
	const stop = () => {
		clearInterval(interval);
		clearTimeout(limit);
		removeEventListener('message', onMessage);
	};
	const onMessage = (event: MessageEvent) => {
		if (event.source === target && event.origin === PLAYER_ORIGIN.youtube) stop();
	};
	addEventListener('message', onMessage);
	const interval = setInterval(handshake, 250);
	const limit = setTimeout(stop, 15_000);
	handshake();
	return stop;
}

/** Подпись источника в переключателе: «YouTube», а при двух YouTube — «YouTube 2». */
export function sourceLabel(sources: TrailerSource[], index: number): string {
	const { provider } = sources[index];
	const same = sources.filter((s) => s.provider === provider);
	if (same.length === 1) return PROVIDER_NAME[provider];
	return `${PROVIDER_NAME[provider]} ${same.indexOf(sources[index]) + 1}`;
}

/** С какого источника начать: с провайдера, который сработал у зрителя в прошлый раз. */
export function startIndex(sources: TrailerSource[], preferred: string | null): number {
	const i = sources.findIndex((s) => s.provider === preferred);
	return i === -1 ? 0 : i;
}

/** Следующий ещё не опробованный источник по приоритету или null, если опробованы все. */
export function nextIndex(count: number, tried: readonly number[]): number | null {
	for (let i = 0; i < count; i++) if (!tried.includes(i)) return i;
	return null;
}

/**
 * Что сообщил плеер:
 * - loaded — плеер только что загрузился (один раз): пора дать команды «без звука», «играть»;
 * - ready — плеер отвечает, но видео не идёт (пауза, перемотка и т. п.);
 * - buffering — видео начало грузиться (автозапуск сработал);
 * - playing — идёт воспроизведение;
 * - ended — видео доиграло (фону нужно начать сначала);
 * - error — плеер сказал, что видео недоступно.
 * Сообщения не от плеера этого провайдера — null.
 */
export type PlayerSignal = 'loaded' | 'ready' | 'buffering' | 'playing' | 'ended' | 'error';

export function playerSignal(
	provider: Provider,
	origin: string,
	data: unknown
): PlayerSignal | null {
	if (origin !== PLAYER_ORIGIN[provider]) return null;
	let msg: unknown = data;
	if (typeof data === 'string') {
		try {
			msg = JSON.parse(data);
		} catch {
			return null;
		}
	}
	if (!msg || typeof msg !== 'object') return null;
	const m = msg as Record<string, unknown>;

	if (provider === 'youtube') {
		// IFrame API (enablejsapi=1): onReady, onStateChange {info: state}, infoDelivery
		// {info: {playerState}}, onError. Состояния: 1 — играет, 3 — буферизация, 0 — доиграло.
		const state = (s: unknown): PlayerSignal =>
			s === 1 ? 'playing' : s === 3 ? 'buffering' : s === 0 ? 'ended' : 'ready';
		switch (m.event) {
			case 'onError':
				return 'error';
			case 'onStateChange':
				return state(m.info);
			case 'infoDelivery': {
				const info = m.info as Record<string, unknown> | null;
				return info && typeof info === 'object' && 'playerState' in info
					? state(info.playerState)
					: 'ready';
			}
			case 'onReady':
				return 'loaded';
			case 'initialDelivery':
				return 'ready';
			default:
				return null;
		}
	}

	// Rutube: {type: 'player:ready' | 'player:changeState' | 'player:playComplete' |
	// 'player:error', data: {state}}.
	switch (m.type) {
		case 'player:error':
			return 'error';
		case 'player:playComplete':
			return 'ended';
		case 'player:changeState': {
			const d = m.data as Record<string, unknown> | null;
			if (!d || typeof d !== 'object') return 'ready';
			const states: Record<string, PlayerSignal> = {
				playing: 'playing',
				buffering: 'buffering',
				ended: 'ended'
			};
			return typeof d.state === 'string' ? (states[d.state] ?? 'ready') : 'ready';
		}
		case 'player:ready':
			return 'loaded';
		default:
			return null;
	}
}

export interface Progress {
	ready: boolean;
	buffering: boolean;
	playing: boolean;
}

/**
 * Таймаут без воспроизведения: переключаться ли на следующий источник.
 * Плеер не ответил вовсе или видео начало грузиться и зависло — сервис недоступен, переключаемся.
 * Плеер загрузился, но видео не стартовало — скорее браузер не дал автозапуск. В модалке зритель
 * нажмёт ▶ сам, источник не меняем; на фоне нажать нельзя (клики проходят мимо) — переключаемся.
 */
export function shouldFallback(p: Progress, { background = false } = {}): boolean {
	if (p.playing) return false;
	return background || !p.ready || p.buffering;
}

const STORAGE_KEY = 'nexus.trailer.provider';

export function readPreferredProvider(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

export function savePreferredProvider(provider: Provider) {
	try {
		localStorage.setItem(STORAGE_KEY, provider);
	} catch {
		// приватный режим или квота — просто не запоминаем
	}
}
