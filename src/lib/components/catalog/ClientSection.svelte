<script lang="ts">
	import type { Snippet } from 'svelte';

	// Раздел статической страницы, содержимое которого живёт только в браузере (рецензии,
	// обсуждения, коллекции на карточке). Заголовок и место под блок — в HTML сразу: якорь
	// #id работает. Содержимое монтируется, когда раздел подходит к экрану (за 200px): блок
	// внутри сам грузит данные, и запросы к API идут, только если до него долистали. До этого —
	// заглушка высотой примерно с содержимое (placeholder, класс Tailwind): иначе страница
	// короткая, нижние разделы сразу попадают в экран, а при загрузке вёрстка прыгает.
	let {
		id,
		title,
		placeholder = 'h-32',
		actions,
		children
	}: {
		id: string;
		title: string;
		placeholder?: string;
		actions?: Snippet;
		children?: Snippet;
	} = $props();

	let section = $state<HTMLElement>();
	let visible = $state(false);

	$effect(() => {
		if (!section || visible) return;
		if (typeof IntersectionObserver === 'undefined') {
			visible = true;
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) visible = true;
			},
			{ rootMargin: '200px 0px' }
		);
		observer.observe(section);
		return () => observer.disconnect();
	});
</script>

<section
	bind:this={section}
	{id}
	aria-labelledby="{id}-title"
	class="mb-12 scroll-mt-32 md:scroll-mt-20"
>
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
		<h2 id="{id}-title" class="text-2xl font-bold">{title}</h2>
		{#if actions}<div class="flex flex-wrap items-center gap-3">{@render actions()}</div>{/if}
	</div>
	{#if visible}
		{@render children?.()}
	{:else if children}
		<div class={['animate-pulse rounded-box bg-base-200', placeholder]} aria-hidden="true"></div>
	{/if}
</section>
