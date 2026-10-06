<script lang="ts">
	import { onMount } from 'svelte';

	// Трейлер наверху карточки, как у Okko: сам запускается без звука (со звуком браузеры
	// автозапуск не дают), идёт по кругу, звук и пауза — кнопками. Вне экрана — на паузе.
	// prefers-reduced-motion — не запускается сам. Видео не загрузилось — onfail, блок прячется.
	let { src, title, onfail }: { src: string; title: string; onfail?: () => void } = $props();

	let video: HTMLVideoElement;
	let muted = $state(true);
	let paused = $state(true);
	/** Пауза по воле пользователя (или автозапуск запрещён): сами не запускаем. */
	let held = $state(false);

	async function start() {
		try {
			await video.play();
		} catch {
			held = true;
		}
	}

	function togglePlay() {
		if (video.paused) {
			held = false;
			void start();
		} else {
			held = true;
			video.pause();
		}
	}

	onMount(() => {
		held = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) video.pause();
				else if (!held) void start();
			},
			{ threshold: 0.25 }
		);
		observer.observe(video);
		return () => observer.disconnect();
	});
</script>

<section
	class="relative left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden bg-black"
	aria-label="Трейлер"
>
	<!-- Субтитров у трейлеров нет, звук по умолчанию выключен. eslint не видит предупреждения
	     svelte-check (muted задаётся через bind), поэтому его правило здесь отключено. -->
	<!-- eslint-disable-next-line svelte/no-unused-svelte-ignore -->
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		bind:muted
		bind:paused
		{src}
		loop
		playsinline
		preload="metadata"
		aria-label="Трейлер: {title}"
		class="aspect-video max-h-[75vh] w-full object-cover"
		onerror={() => onfail?.()}
	></video>

	<!-- Затемнение к фону страницы: снизу под заголовок и постер, слева — под текст. -->
	<div
		class="pointer-events-none absolute inset-0 bg-linear-to-t from-base-100 via-base-100/40 to-base-100/20"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-base-100/80 via-base-100/20 to-transparent md:block"
		aria-hidden="true"
	></div>

	{#if paused && held}
		<button
			class="btn absolute top-1/2 left-1/2 btn-circle -translate-1/2 border-base-content/20 bg-base-100/60 backdrop-blur btn-xl"
			onclick={togglePlay}
			aria-label="Смотреть трейлер"
		>
			<svg class="ml-1 size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
				><path d="M8 5v14l11-7z" /></svg
			>
		</button>
	{/if}

	<div class="absolute top-4 right-4 flex gap-2">
		<button
			class="btn btn-circle border-base-content/20 bg-base-100/50 backdrop-blur btn-sm"
			onclick={togglePlay}
			aria-label={paused ? 'Продолжить трейлер' : 'Пауза'}
		>
			{#if paused}
				<svg class="ml-0.5 size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
					><path d="M8 5v14l11-7z" /></svg
				>
			{:else}
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
					><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg
				>
			{/if}
		</button>
		<button
			class="btn btn-circle border-base-content/20 bg-base-100/50 backdrop-blur btn-sm"
			onclick={() => (muted = !muted)}
			aria-label={muted ? 'Включить звук' : 'Выключить звук'}
		>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
				{#if muted}
					<path d="m16 9 5 6M21 9l-5 6" />
				{:else}
					<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
				{/if}
			</svg>
		</button>
	</div>
</section>
