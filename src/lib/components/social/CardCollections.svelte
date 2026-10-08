<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { browserApi, liveQuery, type CardLive } from '#lib/social/card-live.svelte.ts';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import CollectionCard from './CollectionCard.svelte';

	// «В коллекциях» на карточке: публичные коллекции с этим произведением. Только в браузере
	// (ClientSection).
	let { slug, live }: { slug: string; live: CardLive } = $props();

	const LIMIT = 6;

	const collections = liveQuery(
		() => ({ slug, version: live.version }),
		({ slug }) =>
			unwrap(
				browserApi().social.GET('/api/v1/social/entities/{slug}/collections', {
					params: { path: { slug }, query: { limit: LIMIT } }
				})
			)
	);
	const result = $derived(collections.current);
</script>

{#if !result}
	<div class="h-24 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
{:else if !result.data}
	<LoadError message={result.error} onretry={collections.retry} />
{:else if result.data.items.length}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="В коллекциях">
		{#each result.data.items as collection (collection.id)}
			<li><CollectionCard {collection} /></li>
		{/each}
	</ul>
	{#if result.data.total > LIMIT}
		<p class="mt-3 text-sm text-base-content/50">
			И ещё в {result.data.total - LIMIT} — всего {result.data.total}.
		</p>
	{/if}
{:else}
	<p class="text-base-content/60">Пока ни в одной публичной коллекции.</p>
{/if}
