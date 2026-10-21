<script lang="ts">
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import { asKind } from '#lib/catalog/kinds.ts';
	import { count, summary } from '#lib/catalog/labels.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// Карточка коллекции: коллаж из первых 4 постеров (Collection.preview), название, описание,
	// число произведений и автор. Пустая коллекция — пунктирные места под постеры.

	let { collection, showOwner = true }: { collection: SchemaCollection; showOwner?: boolean } =
		$props();
</script>

<article
	class="flex h-full flex-col rounded-box bg-base-200 p-4 ring-1 ring-base-300 transition hover:ring-primary/50"
>
	<a
		href={buildFeaturedUrl(collection)}
		class="mb-3 grid grid-cols-4 gap-1.5"
		tabindex="-1"
		aria-hidden="true"
	>
		{#each { length: 4 }, i (i)}
			{@const entity = collection.preview[i]}
			{#if entity}
				<Poster
					title={entity.title}
					kind={asKind(entity.kind) ?? 'movie'}
					coverUrl={entity.cover_url}
					small
				/>
			{:else}
				<div
					class="aspect-2/3 rounded-box border border-dashed border-base-content/15 bg-base-100/40"
				></div>
			{/if}
		{/each}
	</a>
	<h3 class="flex items-start gap-2 text-lg leading-snug font-semibold">
		<a href={buildFeaturedUrl(collection)} class="min-w-0 flex-1 hover:text-primary"
			>{collection.title}</a
		>
		{#if !collection.is_public}
			<span class="badge shrink-0 badge-ghost badge-sm" title="Видна только вам">🔒 личная</span>
		{/if}
	</h3>
	{#if collection.description}
		<p class="mt-1 line-clamp-2 text-sm text-base-content/60">
			{summary(collection.description, 140)}
		</p>
	{/if}
	<p class="mt-auto pt-3 text-xs text-base-content/50">
		{count(collection.items_count, ['произведение', 'произведения', 'произведений'])}
		{#if showOwner}
			· <a href="/u/{collection.owner.username}" class="hover:text-primary"
				>{displayName(collection.owner)}</a
			>
		{/if}
	</p>
</article>
