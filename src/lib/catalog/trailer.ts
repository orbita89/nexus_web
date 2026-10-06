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
 * - ready — плеер загрузился (сервис отвечает), но видео ещё не идёт;
 * - buffering — видео начало грузиться (автозапуск сработал);
 * - playing — идёт воспроизведение;
 * - error — плеер сказал, что видео недоступно.
 * Сообщения не от плеера этого провайдера — null.
 */
export type PlayerSignal = 'ready' | 'buffering' | 'playing' | 'error';

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
		// {info: {playerState}}, onError. Состояния: 1 — играет, 3 — буферизация.
		const state = (s: unknown): PlayerSignal =>
			s === 1 ? 'playing' : s === 3 ? 'buffering' : 'ready';
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
			case 'initialDelivery':
				return 'ready';
			default:
				return null;
		}
	}

	// Rutube: {type: 'player:ready' | 'player:changeState' | 'player:error', data: {state}}.
	switch (m.type) {
		case 'player:error':
			return 'error';
		case 'player:changeState': {
			const d = m.data as Record<string, unknown> | null;
			return d && typeof d === 'object' && d.state === 'playing' ? 'playing' : 'ready';
		}
		case 'player:ready':
			return 'ready';
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
 * Плеер загрузился, но видео не стартовало — скорее браузер не дал автозапуск: зритель нажмёт ▶
 * сам, источник не меняем.
 */
export function shouldFallback(p: Progress): boolean {
	if (p.playing) return false;
	return !p.ready || p.buffering;
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
