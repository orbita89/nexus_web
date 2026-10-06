// Выбор источника трейлера в живом плеере — общий для фона карточки и модалки «Трейлер».
// Стартуем с запомненного провайдера; нет воспроизведения за timeoutMs (плеер молчит или завис на
// загрузке) или ошибка плеера — следующий источник. Сработавший провайдер запоминается.
import {
	PROVIDER_NAME,
	nextIndex,
	playerSignal,
	readPreferredProvider,
	savePreferredProvider,
	shouldFallback,
	startIndex,
	type PlayerSignal,
	type Progress,
	type TrailerSource
} from './trailer.ts';

export class TrailerPlayer {
	/** Текущий источник. */
	index = $state(0);
	/** Не сработал ни один источник. */
	failed = $state(false);
	/** Почему переключились: «YouTube недоступен, показываем Rutube». */
	notice = $state('');

	#sources: () => TrailerSource[];
	#timeoutMs: () => number;
	#background: boolean;
	#tried: number[] = [];
	#progress: Progress = { ready: false, buffering: false, playing: false };
	#timer: ReturnType<typeof setTimeout> | undefined;

	/** background — фон шапки: зритель не может нажать ▶, правило таймаута строже. */
	constructor(
		sources: () => TrailerSource[],
		timeoutMs: () => number,
		{ background = false } = {}
	) {
		this.#sources = sources;
		this.#timeoutMs = timeoutMs;
		this.#background = background;
	}

	get current(): TrailerSource {
		return this.#sources()[this.index];
	}

	/** Начать показ: с запомненного провайдера или с первого источника. */
	start() {
		this.#tried = [];
		this.notice = '';
		this.#play(startIndex(this.#sources(), readPreferredProvider()));
	}

	/** Ручной выбор источника. */
	choose(i: number) {
		this.notice = '';
		this.#tried = [];
		this.#play(i);
	}

	stop() {
		clearTimeout(this.#timer);
	}

	/**
	 * Сообщение от плеера. Возвращает сигнал, если оно от текущего iframe и его провайдера
	 * (компонентам нужны loaded — дать команды плееру — и ended — начать сначала).
	 */
	handle(event: MessageEvent, frame: HTMLIFrameElement | undefined): PlayerSignal | null {
		if (this.failed || !frame || event.source !== frame.contentWindow) return null;
		const signal = playerSignal(this.current.provider, event.origin, event.data);
		if (signal === null) return null;
		if (signal === 'error') {
			this.#fallback();
			return signal;
		}
		this.#progress.ready = true;
		if (signal === 'buffering') this.#progress.buffering = true;
		if ((signal === 'playing' || signal === 'ended') && !this.#progress.playing) {
			this.#progress.playing = true;
			clearTimeout(this.#timer);
			savePreferredProvider(this.current.provider);
		}
		return signal;
	}

	#play(i: number) {
		this.index = i;
		this.failed = false;
		if (!this.#tried.includes(i)) this.#tried.push(i);
		clearTimeout(this.#timer);
		this.#progress = { ready: false, buffering: false, playing: false };
		this.#timer = setTimeout(() => {
			if (shouldFallback(this.#progress, { background: this.#background })) this.#fallback();
		}, this.#timeoutMs());
	}

	#fallback() {
		const sources = this.#sources();
		const from = this.current.provider;
		const next = nextIndex(sources.length, this.#tried);
		if (next === null) {
			clearTimeout(this.#timer);
			this.failed = true;
			this.notice = '';
			return;
		}
		const to = sources[next].provider;
		this.notice =
			to === from
				? `${PROVIDER_NAME[from]}: видео недоступно, пробуем другое`
				: `${PROVIDER_NAME[from]} недоступен, показываем ${PROVIDER_NAME[to]}`;
		this.#play(next);
	}
}
