<script lang="ts">
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { count, summary } from '#lib/catalog/labels.ts';
	import { displayName } from '#lib/social/reviews.ts';

	let { collection, showOwner = true }: { collection: SchemaCollection; showOwner?: boolean } =
		$props();
</script>

<article
	class="flex h-full flex-col rounded-box bg-base-200 p-4 ring-1 ring-base-300 transition hover:ring-primary/50"
>
	<h3 class="flex items-start gap-2 text-lg leading-snug font-semibold">
		<a href="/collections/{collection.id}" class="min-w-0 flex-1 hover:text-primary"
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
