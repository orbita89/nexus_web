<script lang="ts">
	import type { SchemaFeedItem } from '#lib/api/generated/social.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import CollectionCard from './CollectionCard.svelte';
	import ReviewItem from './ReviewItem.svelte';
	import ThreadItem from './ThreadItem.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Запись ленты: почему она здесь (подписка, интерес, популярное) и сама запись.
	let { item }: { item: SchemaFeedItem } = $props();

	const what = $derived(
		item.type === 'review' ? 'рецензия' : item.type === 'thread' ? 'тема' : 'коллекция'
	);
</script>

<article class="flex flex-col gap-2">
	<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/50">
		{#each item.reasons as reason, i (i)}
			{#if i}<span aria-hidden="true">·</span>{/if}
			{#if reason.type === 'follow'}
				<span
					>👤 <a
						href="/u/{reason.user.username}"
						class="font-semibold text-base-content/80 hover:text-primary"
						>{displayName(reason.user)}</a
					> — вы подписаны</span
				>
			{:else if reason.type === 'interest'}
				{@const href = refHref(reason.entity)}
				<span
					>🔔 вы следите за {#if href}<a
							{href}
							class="font-semibold text-base-content/80 hover:text-primary">{reason.entity.title}</a
						>{:else}{reason.entity.title}{/if}</span
				>
			{:else}
				<span>🔥 популярное</span>
			{/if}
		{/each}
		<span aria-hidden="true">·</span>
		<span>{what}, <TimeAgo iso={item.created_at} /></span>
	</p>
	{#if item.review}
		<ReviewItem review={item.review} showEntity showAuthor />
	{:else if item.thread}
		<ThreadItem thread={item.thread} />
	{:else if item.collection}
		<CollectionCard collection={item.collection} />
	{/if}
</article>
