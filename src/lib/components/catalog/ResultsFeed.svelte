<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaArchiveDoc, SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { ratingsFor, type Ratings } from '#lib/catalog/load.ts';
	import { archivePage as fetchArchive } from '#lib/catalog/search.ts';
	import ArchiveCard from './ArchiveCard.svelte';
	import EntityCard from './EntityCard.svelte';

	// Выдача одной сеткой: сначала фильмы сайта, за ними — из архива (с надписью «Архив»).
	// «Показать ещё» дописывает карточки: пока у сайта есть ещё — следующую порцию сайта (more), потом
	// — архива. Архив показываем только после всех фильмов сайта, чтобы порядок не прыгал.
	interface Page<T> {
		items: T[];
		total: number;
		offset: number;
	}
	let {
		first,
		more,
		ratings = {},
		archive = null,
		archivePage = 24,
		showKind = false
	}: {
		first: Page<SchemaEntitySummary>;
		/** Следующая порция сайта с этого offset. */
		more: (offset: number) => Promise<Page<SchemaEntitySummary>>;
		ratings?: Ratings;
		/** Архив по тому же запросу (только по названию); null — не ищем. */
		archive?: { q: string; first: { items: SchemaArchiveDoc[]; total: number } } | null;
		archivePage?: number;
		showKind?: boolean;
	} = $props();

	/** Бэкенд листает архив только до offset 1000. */
	const ARCHIVE_MAX_OFFSET = 1000;

	// Новый запрос (другой first) — выдача заново; «Показать ещё» дописывает поверх.
	let site = $derived([...first.items]);
	let siteNext = $derived(first.offset + first.items.length);
	/** total у поиска — оценка Meilisearch: пустая порция тоже значит «всё». */
	let siteDone = $derived(first.offset + first.items.length >= first.total);
	let archived = $derived([...(archive?.first.items ?? [])]);
	let moreRatings = $state<Ratings>({});
	let loading = $state(false);
	let error = $state('');

	const allRatings = $derived({ ...ratings, ...moreRatings });
	const archiveLeft = $derived(
		!!archive && archived.length < archive.first.total && archived.length <= ARCHIVE_MAX_OFFSET
	);
	const canMore = $derived(!siteDone || archiveLeft);

	async function loadMore() {
		loading = true;
		error = '';
		try {
			if (!siteDone) {
				const page = await more(siteNext);
				site = [...site, ...page.items];
				siteNext += page.items.length;
				siteDone = !page.items.length || siteNext >= page.total;
				moreRatings = { ...moreRatings, ...(await ratingsFor(guestApi, page.items)) };
			} else if (archive) {
				const page = await fetchArchive(guestApi, archive.q, archivePage, archived.length);
				archived = [...archived, ...page.items];
			}
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}
</script>

<ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
	{#each site as entity (entity.id)}
		<li>
			<EntityCard {entity} {showKind} rating={allRatings[entity.slug]} />
		</li>
	{/each}
	{#if siteDone}
		{#each archived as doc (doc.slug)}
			<li><ArchiveCard {doc} /></li>
		{/each}
	{/if}
</ul>

{#if error}<p class="mt-4 text-sm text-error">{error}</p>{/if}
{#if canMore}
	<div class="mt-8 flex justify-center">
		<button class="btn btn-wide btn-outline" disabled={loading} onclick={loadMore}>
			{#if loading}<span class="loading loading-xs loading-spinner"></span>{/if}
			Показать ещё
		</button>
	</div>
{/if}
