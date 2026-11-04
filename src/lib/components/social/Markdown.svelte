<script lang="ts">
	import { parseMarkdown } from '#lib/social/markdown.ts';
	import MarkdownInline from './MarkdownInline.svelte';

	// Пользовательский текст с лёгкой разметкой: рецензии, своя заметка, сообщения чата.
	// Никакого {@html}: части рисуются обычными узлами, экранирует их Svelte (см. markdown.ts).
	let { text, class: className = '' }: { text: string; class?: string } = $props();

	const blocks = $derived(parseMarkdown(text));
</script>

<!-- Обычный блок, а не flex: Clamp сворачивает текст через -webkit-box, и на flex-контейнере
     обрезка по строкам не работает — «Читать полностью» не появлялась. -->
<div class={['space-y-3 break-words', className]}>
	{#each blocks as block, i (i)}
		{#if block.kind === 'p'}
			<p class="leading-relaxed whitespace-pre-line"><MarkdownInline parts={block.parts} /></p>
		{:else if block.kind === 'quote'}
			<blockquote
				class="border-l-2 border-primary/40 pl-3 leading-relaxed whitespace-pre-line text-base-content/75"
			>
				<MarkdownInline parts={block.parts} />
			</blockquote>
		{:else if block.kind === 'list' && block.ordered}
			<ol class="flex list-decimal flex-col gap-1 pl-5 marker:text-base-content/40">
				{#each block.items as item, j (j)}<li><MarkdownInline parts={item} /></li>{/each}
			</ol>
		{:else if block.kind === 'list'}
			<ul class="flex list-disc flex-col gap-1 pl-5 marker:text-primary/60">
				{#each block.items as item, j (j)}<li><MarkdownInline parts={item} /></li>{/each}
			</ul>
		{/if}
	{/each}
</div>
