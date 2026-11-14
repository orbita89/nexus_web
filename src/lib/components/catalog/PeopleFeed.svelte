<script lang="ts" module>
	import type { SchemaPersonHit } from '#lib/api/generated/catalog.ts';

	// Что выдача уже показывала во вкладке: вернувшись с карточки, показываем то же без запросов.
	interface Shown {
		items: SchemaPersonHit[];
		total: number;
		done: boolean;
	}
	const LIMIT = 3;
	const feeds = new Map<string, Shown>();

	function keep(key: string, shown: Shown) {
		feeds.delete(key);
		feeds.set(key, shown);
		for (const old of [...feeds.keys()].slice(0, -LIMIT)) feeds.delete(old);
	}
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { unwrap, errorMessage } from '#lib/api/errors.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { SEARCH_MAX_LIMIT } from '#lib/catalog/search.ts';
	import { PAGE_SIZE, feedKey, moreUrl, readMore, shownSize } from '#lib/catalog/url.ts';
	import PersonCard from './PersonCard.svelte';

	// Люди одной сеткой с «Показать ещё». Число догруженных порций — в адресе (?more=), как у
	// каталога: возврат с карточки показывает столько же, сколько было.
	let {
		first,
		q,
		role
	}: {
		first: { items: SchemaPersonHit[]; total: number; offset: number };
		q?: string;
		role?: string;
	} = $props();

	let items = $derived([...first.items]);
	let done = $derived(first.items.length >= first.total);
	let total = $derived(first.total);
	let loading = $state(false);
	let error = $state('');

	const feedUrl = $derived(page.shallow?.url ?? page.url);
	const key = $derived(feedKey(feedUrl));
	/** Крупный топ-3 — только в самой первой выдаче без поиска. */
	const podium = $derived(!q && items.length >= 9);
	/** Крупная тройка не входит в порции по PAGE_SIZE. */
	const extra = $derived(q ? 0 : 3);

	async function add(limit: number) {
		loading = true;
		error = '';
		try {
			const next = await unwrap(
				guestApi.catalog.GET('/api/v1/catalog/search/people', {
					params: { query: { q, known_for: role, limit, offset: items.length } }
				})
			);
			items = [...items, ...next.items];
			total = next.total;
			done = !next.items.length || items.length >= next.total;
			keep(key, { items, total, done });
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	// Возврат с карточки: берём показанное из памяти вкладки, чего нет — догружаем по 100.
	let restoredFor = '';
	$effect(() => {
		const href = feedUrl.href;
		const want = shownSize(feedUrl) + extra;
		if (restoredFor === href || done || loading || items.length >= want) return;
		restoredFor = href;
		const was = feeds.get(key);
		if (was && was.items.length > items.length) {
			items = [...was.items];
			total = was.total;
			done = was.done;
		}
		if (items.length < want && !done) void restore(want);
	});

	async function restore(want: number) {
		while (items.length < want && !done && !error) {
			await add(Math.min(want - items.length, SEARCH_MAX_LIMIT));
		}
	}

	async function loadMore() {
		await add(PAGE_SIZE);
		if (!error)
			await goto(moreUrl(feedUrl, readMore(feedUrl) + 1), {
				state: page.state,
				shallow: true,
				replace: true
			});
	}
</script>

{#snippet card(person: SchemaPersonHit, rank?: number)}
	<PersonCard
		slug={person.slug}
		name={person.full_name}
		original={person.original_name}
		photoUrl={person.photo_url}
		role={person.known_for}
		{rank}
		featured={!!rank}
	/>
{/snippet}

{#if podium}
	<ul class="mb-4 grid grid-cols-3 gap-3 sm:gap-4">
		{#each items.slice(0, 3) as person, i (person.id)}
			<li>{@render card(person, i + 1)}</li>
		{/each}
	</ul>
{/if}
<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
	{#each podium ? items.slice(3) : items as person (person.id)}
		<li>{@render card(person)}</li>
	{/each}
</ul>

{#if error}<p class="mt-4 text-sm text-error">{error}</p>{/if}
{#if !done}
	<div class="mt-10 flex flex-col items-center gap-2">
		<button class="btn btn-wide btn-outline" disabled={loading} onclick={loadMore}>
			{#if loading}<span class="loading loading-xs loading-spinner"></span>{/if}
			Показать ещё
		</button>
		<p class="text-xs text-base-content/50">Показано {items.length}</p>
	</div>
{/if}
