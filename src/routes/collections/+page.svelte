<script lang="ts">
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import CollectionCard from '#lib/components/social/CollectionCard.svelte';
	import NewCollection from '#lib/components/social/NewCollection.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="Коллекции"
	description="Подборки фильмов, сериалов, книг и игр от пользователей Nexus."
/>

<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-3xl font-black sm:text-4xl">Коллекции</h1>
		<p class="mt-1 text-sm text-base-content/50">
			Подборки пользователей: фильмы, сериалы, книги и игры вперемешку.
		</p>
	</div>
	<NewCollection />
</header>

{#if data.collections.error}
	<LoadError message={data.collections.error} />
{:else if data.collections.data?.items.length}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Коллекции">
		{#each data.collections.data.items as collection (collection.id)}
			<li><CollectionCard {collection} /></li>
		{/each}
	</ul>
	<Pagination
		total={data.collections.data.total}
		limit={data.collections.data.limit}
		offset={data.collections.data.offset}
	/>
{:else}
	<EmptyState title="Коллекций пока нет"
		>Соберите первую — например, «Лучшая фантастика».</EmptyState
	>
{/if}
