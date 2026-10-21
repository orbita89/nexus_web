<script lang="ts">
	import type { BannerSlide } from '#lib/catalog/banners.ts';
	import { isExternal } from '#lib/catalog/bannerHtml.ts';
	import BannerHtml from './BannerHtml.svelte';

	// Баннер kind=slides: внутренняя карусель. Листается сама, пока не на паузе
	// (пауза внешней карусели — наведение, фокус, reduced motion — действует и здесь).
	let {
		slides,
		paused,
		reducedMotion,
		themeClass,
		pattern
	}: {
		slides: BannerSlide[];
		paused: boolean;
		reducedMotion: boolean;
		themeClass: string;
		pattern?: string;
	} = $props();

	const INTERVAL = 4500;
	let current = $state(0);
	let track: HTMLDivElement | undefined = $state();
	const many = $derived(slides.length > 1);

	function go(index: number) {
		const n = slides.length;
		current = ((index % n) + n) % n;
		const el = track?.children[current] as HTMLElement | undefined;
		track?.scrollTo({ left: el?.offsetLeft ?? 0, behavior: reducedMotion ? 'auto' : 'smooth' });
	}

	function onScroll() {
		if (!track || !track.clientWidth) return;
		current = Math.round(track.scrollLeft / track.clientWidth);
	}

	$effect(() => {
		if (!many || paused || reducedMotion) return;
		const timer = setInterval(() => go(current + 1), INTERVAL);
		return () => clearInterval(timer);
	});
</script>

<div class="relative h-full w-full">
	<div class="carousel h-full w-full" bind:this={track} onscroll={onScroll}>
		{#each slides as slide, i (i)}
			<div
				class="relative carousel-item h-full w-full bg-linear-to-br {slide.image_url
					? ''
					: themeClass}"
				role="group"
				aria-roledescription="slide"
				aria-label="Слайд {i + 1} из {slides.length}"
			>
				{#if slide.image_url}
					<img
						src={slide.image_url}
						alt=""
						class="absolute inset-0 h-full w-full object-cover"
						loading="lazy"
						decoding="async"
					/>
				{:else if pattern}
					<div class="pointer-events-none absolute inset-0" style:background={pattern}></div>
				{/if}
				<div
					class={[
						'relative flex h-full w-full flex-col justify-end px-5 pt-10 pb-5 sm:px-8 sm:pb-7',
						slide.image_url &&
							'bg-linear-to-t from-black/80 via-black/40 to-transparent text-white',
						many && 'pb-10 sm:pb-12'
					]}
				>
					{#if slide.title}
						<h3 class="text-xl leading-tight font-black sm:text-3xl">
							{#if slide.link_url && isExternal(slide.link_url)}
								<a href={slide.link_url} target="_blank" rel="noopener" class="link link-hover"
									>{slide.title}</a
								>
							{:else if slide.link_url}
								<a href={slide.link_url} class="link link-hover">{slide.title}</a>
							{:else}
								{slide.title}
							{/if}
						</h3>
					{/if}
					{#if slide.subtitle}
						<p class="mt-1 max-w-2xl text-sm opacity-80 sm:text-base">{slide.subtitle}</p>
					{/if}
					{#if slide.content_html}
						<BannerHtml html={slide.content_html} class="mt-2 max-w-2xl" />
					{/if}
				</div>
			</div>
		{/each}
	</div>
	{#if many}
		<div class="absolute top-3 right-3 flex gap-1.5">
			{#each slides, i (i)}
				<button
					type="button"
					class="h-1.5 rounded-full transition-all {i === current
						? 'w-5 bg-current'
						: 'w-1.5 bg-current opacity-40 hover:opacity-70'}"
					aria-label="Слайд {i + 1}"
					aria-current={i === current}
					onclick={() => go(i)}
				></button>
			{/each}
		</div>
	{/if}
</div>
