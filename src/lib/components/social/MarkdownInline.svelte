<script lang="ts">
	import type { Inline } from '#lib/social/markdown.ts';
	import Self from './MarkdownInline.svelte';

	// Инлайн-разметка одной строки: её рисует и Markdown.svelte (блоки), и чат (там свои части —
	// упоминания, — а разметка применяется к тексту между ними). Без {@html}: экранирует Svelte.
	let { parts }: { parts: Inline[] } = $props();
</script>

{#each parts as part, i (i)}
	{#if part.kind === 'text'}{part.text}
	{:else if part.kind === 'link'}<a
			href={part.href}
			class="link link-primary"
			target="_blank"
			rel="nofollow noopener noreferrer ugc">{part.text}</a
		>
	{:else if part.kind === 'bold'}<strong class="font-semibold"><Self parts={part.parts} /></strong>
	{:else if part.kind === 'italic'}<em><Self parts={part.parts} /></em>
	{:else if part.kind === 'strike'}<s class="opacity-70"><Self parts={part.parts} /></s>
	{:else}<code class="rounded bg-base-content/10 px-1 py-0.5 text-[0.9em]"
			><Self parts={part.parts} /></code
		>{/if}
{/each}
