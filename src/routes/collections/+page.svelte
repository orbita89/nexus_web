<script lang="ts">
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import CollectionCard from '#lib/components/social/CollectionCard.svelte';
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
	import NewCollection from '#lib/components/social/NewCollection.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title={data.q ? `Коллекции: ${data.q}` : 'Коллекции'}
	description="Подборки фильмов, сериалов, книг и игр от пользователей Кассандра."
/>

<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-3xl font-black sm:text-4xl">
			{data.q ? `Коллекции: ${data.q}` : 'Коллекции'}
		</h1>
		<p class="mt-1 text-sm text-base-content/50">
			Подборки пользователей: фильмы, сериалы, книги и игры вперемешку.
		</p>
	</div>
	<NewCollection />
</header>

<!-- Поиск по названию и описанию: ?q= (Meilisearch, приватных в индексе нет). -->
<form method="GET" action="/collections" role="search" class="mb-6 flex max-w-xl gap-2">
	<input
		type="search"
		name="q"
		value={data.q ?? ''}
		placeholder="Название коллекции"
		aria-label="Найти коллекцию"
		class="input w-full"
	/>
	<button class="btn btn-primary">Найти</button>
</form>

{#if data.collections.error}
	<LoadError message={data.collections.error} />
{:else if data.collections.data?.items.length}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Коллекции">
		{#each data.collections.data.items as collection (collection.id)}
			<li class={collection.is_featured ? 'sm:col-span-2' : undefined}>
				{#if collection.is_featured}<FeaturedCollectionCard {collection} />{:else}<CollectionCard
						{collection}
					/>{/if}
			</li>
		{/each}
	</ul>
	<Pagination
		total={data.collections.data.total}
		limit={data.collections.data.limit}
		offset={data.collections.data.offset}
	/>
{:else if data.q}
	<EmptyState title="Ничего не нашлось">
		По запросу «{data.q}» коллекций нет.
		<a href="/collections" class="link link-primary">Все коллекции</a>.
	</EmptyState>
{:else}
	<EmptyState title="Коллекций пока нет"
		>Соберите первую — например, «Лучшая фантастика».</EmptyState
	>
{/if}
