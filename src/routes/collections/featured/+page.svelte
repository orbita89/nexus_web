<script lang="ts">
	import { page } from '$app/state';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="Подборки"
	description="Подборки и рейтинги фильмов, сериалов, книг и игр от редакции Кассандра."
/>
<svelte:head>
	<link rel="canonical" href="{page.url.origin}/collections/featured" />
</svelte:head>

<header class="mb-8">
	<h1 class="text-3xl font-bold">Подборки</h1>
	<p class="mt-2 text-base-content/70">Рейтинги и тематические подборки от редакции.</p>
</header>

{#if data.featured.error}
	<LoadError message={data.featured.error} />
{:else if data.featured.data?.length}
	<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Подборки">
		{#each data.featured.data as collection (collection.id)}
			<li><FeaturedCollectionCard {collection} /></li>
		{/each}
	</ul>
{:else}
	<EmptyState title="Подборок пока нет">Загляните позже.</EmptyState>
{/if}
