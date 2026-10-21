<script lang="ts">
	import type { Banner } from '#lib/catalog/banners.ts';
	import { isExternal } from '#lib/catalog/bannerHtml.ts';
	import { DEFAULT_THEME, FEATURED_THEMES } from '#lib/catalog/themes.ts';
	import BannerButtons from './BannerButtons.svelte';
	import BannerHtml from './BannerHtml.svelte';

	// Баннеры страницы (промо, новости) — карусель во всю ширину. Несколько — автопрокрутка
	// (пауза при наведении, фокусе и prefers-reduced-motion), точки и стрелки; один — без управления.
	// Пустой список — ничего не рисуем. Виды: image (картинка со ссылкой), html (санитизированный
	// content_html на фоне картинки или темы); устаревший slides рисуем как html. Кнопки — btn по style.
	let { banners }: { banners: Banner[] } = $props();

	const INTERVAL = 6000;

	let current = $state(0);
	let paused = $state(false);
	let reducedMotion = $state(false);
	let track: HTMLDivElement | undefined = $state();

	const many = $derived(banners.length > 1);

	function go(index: number) {
		const n = banners.length;
		current = ((index % n) + n) % n;
		const slide = track?.children[current] as HTMLElement | undefined;
		track?.scrollTo({ left: slide?.offsetLeft ?? 0, behavior: reducedMotion ? 'auto' : 'smooth' });
	}

	/** Ручная прокрутка свайпом — синхронизируем точки. */
	function onScroll() {
		if (!track || !track.clientWidth) return;
		current = Math.round(track.scrollLeft / track.clientWidth);
	}

	$effect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = media.matches;
		const update = () => (reducedMotion = media.matches);
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	$effect(() => {
		if (!many || paused || reducedMotion) return;
		const timer = setInterval(() => go(current + 1), INTERVAL);
		return () => clearInterval(timer);
	});

	// Тема баннера — те же пресеты, что у подборок (градиент и узор на токенах daisyUI).
	const themeOf = (b: Banner) => FEATURED_THEMES.find((t) => t.id === b.theme) ?? DEFAULT_THEME;
</script>

{#snippet linked(href: string | null | undefined, text: string)}
	{#if href && isExternal(href)}
		<a {href} target="_blank" rel="noopener" class="link link-hover">{text}</a>
	{:else if href}
		<a {href} class="link link-hover">{text}</a>
	{:else}
		{text}
	{/if}
{/snippet}

{#if banners.length}
	<section
		class="group relative mb-8 overflow-hidden rounded-box ring-1 ring-base-300"
		aria-roledescription="carousel"
		aria-label="Баннеры"
		onmouseenter={() => (paused = true)}
		onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)}
		onfocusout={() => (paused = false)}
	>
		<div class="carousel w-full" bind:this={track} onscroll={onScroll}>
			{#each banners as banner, i (banner.id)}
				{@const theme = themeOf(banner)}
				<div
					class={[
						'relative carousel-item w-full overflow-hidden',
						banner.kind === 'image'
							? 'aspect-[3/1] max-sm:aspect-[16/9]'
							: 'min-h-56 sm:aspect-[3/1] sm:min-h-0'
					]}
					role="group"
					aria-roledescription="slide"
					aria-label="{i + 1} из {banners.length}"
				>
					{#if banner.kind !== 'image'}
						<div
							class="relative h-full w-full bg-linear-to-br {banner.image_url
								? ''
								: theme.gradient}"
						>
							{#if banner.image_url}
								<img
									src={banner.image_url}
									alt=""
									class="absolute inset-0 h-full w-full object-cover"
									loading={i === 0 ? 'eager' : 'lazy'}
									decoding="async"
								/>
							{:else if theme.pattern}
								<div
									class="pointer-events-none absolute inset-0"
									style:background={theme.pattern}
								></div>
							{/if}
							<div
								class={[
									'relative flex h-full w-full flex-col justify-end px-5 pt-10 pb-5 sm:px-8 sm:pb-7',
									banner.image_url &&
										'bg-linear-to-t from-black/85 via-black/50 to-black/10 text-white',
									many && 'pb-10 sm:pb-12'
								]}
							>
								{#if banner.title}
									<h2 class="text-xl leading-tight font-black sm:text-3xl">
										{@render linked(banner.link_url, banner.title)}
									</h2>
								{/if}
								{#if banner.subtitle}
									<p class="mt-1 max-w-2xl text-sm opacity-80 sm:text-base">{banner.subtitle}</p>
								{/if}
								{#if banner.content_html}
									<BannerHtml html={banner.content_html} class="mt-2 max-w-2xl" />
								{/if}
								<BannerButtons buttons={banner.buttons} />
							</div>
						</div>
					{:else}
						{#snippet body()}
							{#if banner.image_url}
								<img
									src={banner.image_url}
									alt=""
									class="absolute inset-0 h-full w-full object-cover"
									loading={i === 0 ? 'eager' : 'lazy'}
									decoding="async"
								/>
							{:else}
								<div class="absolute inset-0 bg-linear-to-br {theme.gradient}"></div>
							{/if}
							<div
								class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-5 pt-12 pb-5 text-white sm:px-8 sm:pb-7"
								class:pb-10={many}
								class:sm:pb-12={many}
							>
								<h2 class="text-xl leading-tight font-black sm:text-3xl">{banner.title}</h2>
								{#if banner.subtitle}
									<p class="mt-1 max-w-2xl text-sm text-white/80 sm:text-base">{banner.subtitle}</p>
								{/if}
							</div>
						{/snippet}
						{#if banner.buttons.length}
							<div class="relative h-full w-full">
								{@render body()}
								<div class="absolute top-0 right-0 px-5 sm:px-8">
									<BannerButtons buttons={banner.buttons} />
								</div>
							</div>
						{:else if banner.link_url && isExternal(banner.link_url)}
							<a href={banner.link_url} target="_blank" rel="noopener" class="block h-full w-full">
								{@render body()}
							</a>
						{:else if banner.link_url}
							<a href={banner.link_url} class="block h-full w-full">{@render body()}</a>
						{:else}
							{@render body()}
						{/if}
					{/if}
				</div>
			{/each}
		</div>

		{#if many}
			<button
				type="button"
				class="btn absolute top-1/2 left-2 btn-circle -translate-y-1/2 border-0 bg-black/40 text-white btn-sm hover:bg-black/60"
				aria-label="Предыдущий баннер"
				onclick={() => go(current - 1)}>❮</button
			>
			<button
				type="button"
				class="btn absolute top-1/2 right-2 btn-circle -translate-y-1/2 border-0 bg-black/40 text-white btn-sm hover:bg-black/60"
				aria-label="Следующий баннер"
				onclick={() => go(current + 1)}>❯</button
			>
			<div class="absolute inset-x-0 bottom-3 flex justify-center gap-2">
				{#each banners as banner, i (banner.id)}
					<button
						type="button"
						class="h-2 rounded-full transition-all {i === current
							? 'w-6 bg-white'
							: 'w-2 bg-white/50 hover:bg-white/80'}"
						aria-label="Баннер {i + 1}"
						aria-current={i === current}
						onclick={() => go(i)}
					></button>
				{/each}
			</div>
		{/if}
	</section>
{/if}
