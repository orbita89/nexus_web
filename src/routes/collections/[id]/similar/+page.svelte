<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import CollectionCard from '#lib/components/social/CollectionCard.svelte';
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	onMount(() => {
		if (!data.collection) void invalidateAll();
	});

	const collection = $derived(data.collection);
	const back = $derived(collection ? buildFeaturedUrl(collection) : '/collections');
</script>

<svelte:head>
	<meta name="robots" content="noindex, follow" />
	{#if collection}
		<title>Похожие на «{collection.title}» | Nexus</title>
		<link rel="canonical" href="{page.url.origin}{back}/similar" />
	{/if}
</svelte:head>

{#if !collection}
	<div class="h-40 skeleton" aria-label="Загрузка коллекции"></div>
{:else}
	<header class="mb-6">
		<a href={back} class="link text-sm link-hover">← К подборке</a>
		<h1 class="mt-2 text-2xl font-black sm:text-3xl">Похожие на «{collection.title}»</h1>
	</header>
	{#if data.others.length}
		<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.others as other (other.id)}
				<li>
					{#if other.is_featured}
						<FeaturedCollectionCard collection={other} />
					{:else}
						<CollectionCard collection={other} />
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState title="Похожих подборок пока нет" />
	{/if}
{/if}
