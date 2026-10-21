<script lang="ts">
	import { onMount } from 'svelte';
	import { bannerHtmlText, sanitizeBannerHtml } from '#lib/catalog/bannerHtml.ts';

	// content_html баннера/слайда: в браузере — через DOMPurify, при SSR — только текст.
	let { html, class: klass = '' }: { html: string; class?: string } = $props();

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

<div class="banner-html {klass}">
	{#if mounted}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- санитизировано DOMPurify -->
		{@html sanitizeBannerHtml(html)}
	{:else}
		<p>{bannerHtmlText(html)}</p>
	{/if}
</div>

<style>
	.banner-html :global(h1),
	.banner-html :global(h2),
	.banner-html :global(h3) {
		font-weight: 900;
		line-height: 1.15;
		font-size: 1.5rem;
	}
	.banner-html :global(p) {
		margin-top: 0.35rem;
	}
	.banner-html :global(a) {
		text-decoration: underline;
	}
	.banner-html :global(ul) {
		list-style: disc;
		padding-left: 1.25rem;
	}
	@media (min-width: 640px) {
		.banner-html :global(h1),
		.banner-html :global(h2) {
			font-size: 2rem;
		}
	}
</style>
