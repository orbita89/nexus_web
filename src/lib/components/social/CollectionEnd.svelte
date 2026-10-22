<script lang="ts">
	import type { SchemaCollection, SchemaCollectionDetail } from '#lib/api/generated/social.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import ShareMenu from '#lib/components/social/ShareMenu.svelte';

	// Конец страницы коллекции: «Далее» (первая из похожих) и ряд действий — поделиться,
	// обсуждение, все похожие. Обычные ссылки — перелинковка для SEO.
	let {
		collection,
		others = [],
		shareUrl,
		shareTitle
	}: {
		collection: SchemaCollectionDetail;
		others?: SchemaCollection[];
		shareUrl: string;
		shareTitle: string;
	} = $props();

	const base = $derived(buildFeaturedUrl(collection));
	const next = $derived(others[0]);
	const works = (n: number) => count(n, ['произведение', 'произведения', 'произведений']);
</script>

<footer class="mx-auto mt-10 max-w-4xl space-y-8 border-t border-base-content/10 pt-10">
	{#if next}
		<a href={buildFeaturedUrl(next)} class="group block">
			<span class="flex items-center gap-2 text-xs tracking-wider text-base-content/60 uppercase">
				<span class="h-px w-6 bg-(--page-accent,var(--color-primary))" aria-hidden="true"></span>
				Далее
			</span>
			<span class="mt-1 block text-lg font-semibold group-hover:text-primary">
				{next.title}
				<span class="font-normal text-base-content/60">· {works(next.items_count)} →</span>
			</span>
		</a>
	{/if}
	<div class="flex flex-wrap items-center justify-center gap-3">
		<ShareMenu url={shareUrl} title={shareTitle} />
		<a href="{base}/discussion" class="btn btn-outline btn-sm"
			>Обсуждение ({collection.comments_count ?? 0})</a
		>
		{#if others.length}
			<a href="{base}/similar" class="btn btn-outline btn-sm">Все похожие ({others.length})</a>
		{/if}
	</div>
</footer>
