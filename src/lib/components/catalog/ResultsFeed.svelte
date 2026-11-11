<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaArchiveDoc, SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { ratingsFor, type Ratings } from '#lib/catalog/load.ts';
	import { archivePage as fetchArchive } from '#lib/catalog/search.ts';
	import type { Row } from '#lib/catalog/row.ts';
	import { PAGE_SIZE, moreUrl, readMore, shownSize } from '#lib/catalog/url.ts';
	import ArchiveCard from './ArchiveCard.svelte';
	import ArtWall from './ArtWall.svelte';
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
		showKind = false,
		wall = false,
		row
	}: {
		first: Page<SchemaEntitySummary>;
		/** Следующая порция сайта с этого offset; limit — чтобы вернуть сразу несколько порций. */
		more: (offset: number, limit?: number) => Promise<Page<SchemaEntitySummary>>;
		ratings?: Ratings;
		/** Архив по тому же запросу (только по названию); null — не ищем. */
		archive?: { q: string; first: { items: SchemaArchiveDoc[]; total: number } } | null;
		archivePage?: number;
		showKind?: boolean;
		/** Стена картин: колонки вместо сетки, высота карточки — по холсту. */
		wall?: boolean;
		/** Параметры этой выдачи: по ним карточка листает соседние работы (row.ts). */
		row?: Row;
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

	/**
	 * Адрес в строке браузера: «Показать ещё» правит его неглубокой навигацией, и тогда `page.url`
	 * остаётся прежним (по нему SvelteKit перезапускает load), а настоящий адрес — в `page.shallow`.
	 */
	const feedUrl = $derived(page.shallow?.url ?? page.url);

	// Возврат с карточки: сколько порций догрузили, записано в адресе (?more=). Если страница
	// отдала только первую порцию (назад из карточки, статичная студия) — добираем одним запросом.
	let restoredFor = $state<string | null>(null);
	$effect(() => {
		const href = feedUrl.href;
		const want = shownSize(feedUrl);
		if (restoredFor === href || siteDone || loading || site.length >= want) return;
		restoredFor = href;
		void addSite(want - site.length);
	});

	/** Дописать следующие limit карточек сайта. */
	async function addSite(limit: number) {
		loading = true;
		error = '';
		try {
			const next = await more(siteNext, limit);
			site = [...site, ...next.items];
			siteNext += next.items.length;
			siteDone = !next.items.length || siteNext >= next.total;
			moreRatings = { ...moreRatings, ...(await ratingsFor(guestApi, next.items)) };
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!siteDone) {
			await addSite(PAGE_SIZE);
			// Порция в адресе: вернувшись с карточки, увидим столько же, сколько и ушли.
			if (!error)
				await goto(moreUrl(feedUrl, readMore(feedUrl) + 1), {
					state: page.state,
					shallow: true,
					replace: true
				});
			return;
		}
		loading = true;
		error = '';
		try {
			if (archive) {
				const chunk = await fetchArchive(guestApi, archive.q, archivePage, archived.length);
				archived = [...archived, ...chunk.items];
			}
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}
</script>

{#snippet tile(entity: SchemaEntitySummary)}
	<EntityCard {entity} {showKind} {wall} {row} rating={allRatings[entity.slug]} />
{/snippet}

{#if wall}
	<!-- Стена картин: «Показать ещё» дописывает холсты, уже показанные не переезжают. -->
	<ArtWall items={site} key={(entity) => entity.id} {tile} />
{:else}
	<ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
		{#each site as entity (entity.id)}
			<li>{@render tile(entity)}</li>
		{/each}
		{#if siteDone}
			{#each archived as doc (doc.slug)}
				<li><ArchiveCard {doc} /></li>
			{/each}
		{/if}
	</ul>
{/if}

{#if error}<p class="mt-4 text-sm text-error">{error}</p>{/if}
{#if canMore}
	<div class="mt-8 flex justify-center">
		<button class="btn btn-wide btn-outline" disabled={loading} onclick={loadMore}>
			{#if loading}<span class="loading loading-xs loading-spinner"></span>{/if}
			Показать ещё
		</button>
	</div>
{/if}
