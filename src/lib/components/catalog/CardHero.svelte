<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { TrailerPlayer } from '#lib/catalog/trailer-player.svelte.ts';
	import {
		backgroundUrl,
		sendCommand,
		subscribe,
		type PlayerCommand,
		type TrailerSource
	} from '#lib/catalog/trailer.ts';

	// Шапка карточки как у Okko: трейлер — не плеер, а фон страницы. Сам запускается без звука,
	// идёт по кругу; звук, пауза и полный экран — нашими кнопками. Поверх — информация (children):
	// на десктопе слева на затемнении, на телефоне — под видео. Нет трейлера, он не запустился или
	// включено «уменьшить движение» — фон из размытой обложки, без постера.
	let {
		sources,
		title,
		kind,
		coverUrl,
		timeoutMs = 8000,
		children
	}: {
		sources: TrailerSource[];
		title: string;
		kind: SchemaEntityKind;
		coverUrl?: string | null;
		/** Сколько ждать начала воспроизведения, прежде чем перейти к следующему источнику. */
		timeoutMs?: number;
		children: Snippet;
	} = $props();

	const player = new TrailerPlayer(
		() => sources,
		() => timeoutMs,
		{ background: true }
	);

	let root: HTMLElement;
	let frame = $state<HTMLIFrameElement>();
	/** Видео можно показывать: браузер, есть источники, нет «уменьшить движение». */
	let enabled = $state(false);
	/** Адрес, который заиграл: iframe проявляется, когда это текущий источник. */
	let playingSrc = $state('');
	let muted = $state(true);
	/** На паузе по воле зрителя (или пока открыта модалка «Трейлер»). На паузе видео гаснет до
	 *  размытой обложки: иначе посреди кадра — значок паузы и «Другие видео» плеера, которые на фоне
	 *  не нажать (клики проходят мимо) и которые убрать параметрами плеера нельзя. */
	let held = $state(false);
	let fullscreen = $state(false);
	/** Шапка ушла с экрана — видео на паузе. */
	let away = $state(false);

	const showVideo = $derived(enabled && !player.failed);
	const src = $derived(showVideo ? backgroundUrl(player.current, location.origin) : '');

	// После «играть» Rutube снова показывает свои кнопки — каждый раз прячем интерфейс.
	const command = (c: PlayerCommand) => {
		sendCommand(frame, player.current.provider, c);
		if (c === 'play' || c === 'restart') sendCommand(frame, player.current.provider, 'bare');
	};

	onMount(() => {
		if (!sources.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		enabled = true;
		player.start();
		// Ушёл с экрана — пауза: видео не крутится зря.
		const observer = new IntersectionObserver(
			([entry]) => {
				away = !entry.isIntersecting;
				if (away) command('pause');
				else if (!held) command('play');
			},
			{ threshold: 0.25 }
		);
		observer.observe(root);
		const onFullscreen = () => (fullscreen = document.fullscreenElement === root);
		document.addEventListener('fullscreenchange', onFullscreen);
		return () => {
			player.stop();
			unsubscribe();
			observer.disconnect();
			document.removeEventListener('fullscreenchange', onFullscreen);
		};
	});

	let unsubscribe = () => {};

	function onMessage(event: MessageEvent) {
		const signal = player.handle(event, frame);
		// Rutube не понимает mute=1 в адресе и со звуком сам не стартует: даём команды явно.
		if (signal === 'loaded') {
			command('bare');
			command(muted ? 'mute' : 'unmute');
			if (!held) command('play');
		}
		if (signal === 'playing') {
			command('bare');
			playingSrc = src;
		}
		// Rutube по кругу сам не играет — начинаем сначала (YouTube крутит loop=1).
		if (signal === 'ended') command('restart');
	}

	// load у Rutube приходит позже начала воспроизведения — здесь только рукопожатие YouTube.
	function onFrameLoad() {
		unsubscribe();
		unsubscribe = subscribe(frame, player.current.provider);
	}

	function toggleMute() {
		muted = !muted;
		command(muted ? 'mute' : 'unmute');
	}

	function togglePause() {
		held = !held;
		command(held ? 'pause' : 'play');
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) void document.exitFullscreen();
		else void root.requestFullscreen?.();
	}

	/** Модалка «Трейлер» открылась — фон на паузу и без звука; закрылась — продолжаем. */
	export function pause() {
		command('pause');
	}
	export function resume() {
		if (!held) command('play');
	}
</script>

<svelte:window onmessage={onMessage} />

<section
	bind:this={root}
	class={[
		'relative w-screen bg-base-100',
		// Во всю ширину окна из контейнера страницы — сдвигом на половину. В полном экране сдвиг
		// снимаем: иначе браузер ставит элемент в 0,0, а translate уводит половину плеера за край.
		fullscreen ? 'h-screen' : 'left-1/2 -mt-6 mb-8 -translate-x-1/2'
	]}
	aria-label="Шапка: {title}"
>
	<!-- Фон: видео или размытая обложка. На телефоне — полоса 16:9, на десктопе — под текстом. -->
	<div
		class={[
			'relative w-full overflow-hidden bg-black',
			// В полном экране — весь экран и на телефоне. С трейлером — кадр 16:9 (на десктопе до
			// 82vh), без него — невысокая полоса фона.
			fullscreen
				? 'h-screen'
				: sources.length
					? 'aspect-video md:aspect-auto md:h-[min(56.25vw,82vh)] md:min-h-[30rem]'
					: 'h-40 md:h-[26rem]'
		]}
	>
		{#if coverUrl}
			<img
				src={coverUrl}
				alt=""
				class="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl"
			/>
		{:else}
			<div
				class={[
					'absolute inset-0 bg-linear-to-br via-base-200 to-base-100',
					{
						'from-primary/30': kind === 'movie',
						'from-secondary/30': kind === 'series',
						'from-accent/25': kind === 'book',
						'from-info/25': kind === 'game'
					}
				]}
			></div>
		{/if}

		{#if showVideo}
			{#key src}
				<!-- Чуть крупнее кадра: срезает края плеера с подписями. Клики проходят мимо: это фон. -->
				<iframe
					bind:this={frame}
					{src}
					title="Трейлер: {title}"
					tabindex="-1"
					class={[
						'pointer-events-none absolute top-1/2 left-0 aspect-video w-full -translate-y-1/2 scale-[1.35] transition-opacity duration-700',
						playingSrc === src && !held && !away ? 'opacity-100' : 'opacity-0'
					]}
					allow="autoplay; encrypted-media; picture-in-picture"
					referrerpolicy="strict-origin-when-cross-origin"
					onload={onFrameLoad}
				></iframe>
			{/key}
		{/if}

		<!-- Затемнение к фону страницы: снизу и слева — под текст. В полном экране — только видео. -->
		{#if !fullscreen}
			<div
				class="pointer-events-none absolute inset-0 bg-linear-to-t from-base-100 via-base-100/0 via-35% to-transparent"
				aria-hidden="true"
			></div>
			<div
				class="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-base-100/95 via-base-100/50 via-35% to-transparent to-70% md:block"
				aria-hidden="true"
			></div>
		{/if}

		{#if showVideo}
			<div class="absolute right-4 bottom-4 z-20 flex gap-2 md:right-8 md:bottom-10">
				{#each [{ label: held ? 'Продолжить фон' : 'Пауза', onclick: togglePause, icon: held ? 'play' : 'pause' }, { label: muted ? 'Включить звук' : 'Выключить звук', onclick: toggleMute, icon: muted ? 'muted' : 'sound' }, { label: fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран', onclick: toggleFullscreen, icon: fullscreen ? 'exit' : 'full' }] as b (b.icon)}
					<button
						class="btn btn-circle border-base-content/10 bg-base-100/50 backdrop-blur btn-md hover:bg-base-100/80"
						aria-label={b.label}
						onclick={b.onclick}
					>
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							{#if b.icon === 'play'}
								<path d="M8 5v14l11-7z" fill="currentColor" />
							{:else if b.icon === 'pause'}
								<path d="M7 5v14M17 5v14" />
							{:else if b.icon === 'muted'}
								<path d="M11 5 6 9H3v6h3l5 4z" /><path d="m16 9 5 6M21 9l-5 6" />
							{:else if b.icon === 'sound'}
								<path d="M11 5 6 9H3v6h3l5 4z" /><path
									d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"
								/>
							{:else if b.icon === 'full'}
								<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
							{:else}
								<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
							{/if}
						</svg>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Информация: на десктопе поверх фона слева снизу, на телефоне — под видео. В полном экране
	     скрыта (hidden — не {#if}: кнопки внутри живут своей жизнью, не перемонтируем). -->
	<div
		class="relative z-10 mx-auto -mt-10 max-w-6xl px-4 md:absolute md:inset-x-0 md:bottom-10 md:mt-0"
		hidden={fullscreen}
	>
		<div class="max-w-2xl">{@render children()}</div>
	</div>
</section>
