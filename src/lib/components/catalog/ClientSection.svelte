<script lang="ts">
	import type { Snippet } from 'svelte';

	// Раздел статической страницы, содержимое которого живёт только в браузере (рецензии,
	// обсуждения, коллекции на карточке). Заголовок и место под блок — в HTML сразу: якорь
	// #id работает, вёрстка не прыгает. Сюда вставляется клиентский компонент, который сам
	// грузит данные из API, когда раздел показался на экране.
	let {
		id,
		title,
		actions,
		children
	}: { id: string; title: string; actions?: Snippet; children?: Snippet } = $props();
</script>

<section {id} aria-labelledby="{id}-title" class="mb-12 scroll-mt-20">
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
		<h2 id="{id}-title" class="text-2xl font-bold">{title}</h2>
		{#if actions}<div class="flex flex-wrap items-center gap-3">{@render actions()}</div>{/if}
	</div>
	{@render children?.()}
</section>
