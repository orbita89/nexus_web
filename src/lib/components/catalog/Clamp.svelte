<script lang="ts">
	import type { Snippet } from 'svelte';

	// Текст, свёрнутый до lines строк, с кнопкой «Читать далее», если он правда не влез. Влезает ли
	// — меряем в браузере (ширина экрана, шрифт), и при изменении размера тоже. В статическом HTML
	// текст свёрнут, кнопки нет: она появляется после гидрации, если нужна.
	let {
		lines = 4,
		more = 'Читать далее…',
		less = 'Свернуть',
		class: className = '',
		children
	}: {
		lines?: 3 | 4 | 6;
		more?: string;
		less?: string;
		class?: string;
		children: Snippet;
	} = $props();

	// Классы целиком — чтобы Tailwind их нашёл.
	const CLAMP = { 3: 'line-clamp-3', 4: 'line-clamp-4', 6: 'line-clamp-6' };

	let box = $state<HTMLElement>();
	let expanded = $state(false);
	let overflows = $state(false);

	$effect(() => {
		if (!box || expanded) return;
		const el = box;
		const measure = () => (overflows = el.scrollHeight > el.clientHeight + 1);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<div bind:this={box} class={[className, { [CLAMP[lines]]: !expanded }]}>
	{@render children()}
</div>
{#if overflows || expanded}
	<button
		class="btn mt-1 btn-link px-0 btn-sm"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}>{expanded ? less : more}</button
	>
{/if}
