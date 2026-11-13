<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import JournalFilters from '#lib/components/profile/JournalFilters.svelte';
	import JournalItemCard from '#lib/components/profile/JournalItemCard.svelte';
	import { loadJournal, readJournalParams, type JournalPage } from '#lib/social/journal.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const username = $derived(data.username);
	const isOwner = $derived(session.status === 'authed' && session.user?.username === username);
	const filters = $derived(readJournalParams(page.url, isOwner));

	// Гостевая выдача пришла из load; владелец перечитывает её с токеном, а «Показать ещё»
	// дописывает элементы без перезагрузки шапки. Смена фильтра сбрасывает курсор.
	let own = $state<{ key: string; page: JournalPage } | null>(null);
	let extra = $state<{ key: string; items: JournalPage['items']; cursor: string | null } | null>(
		null
	);
	let error = $state('');
	let loading = $state(false);

	const key = $derived(
		JSON.stringify([username, isOwner, filters.filter, filters.kind, filters.q])
	);

	$effect(() => {
		const k = key;
		error = '';
		if (!isOwner) return;
		let stale = false;
		loading = true;
		loadJournal(api, username, filters, true)
			.then((p) => !stale && (own = { key: k, page: p }))
			.catch((e) => !stale && (error = errorMessage(e)))
			.finally(() => !stale && (loading = false));
		return () => {
			stale = true;
		};
	});

	// Гость: данные load актуальны для адреса. Владелец: пока своё не пришло — прошлое видно.
	const base = $derived<JournalPage>(
		isOwner ? (own && own.key === key ? own.page : { items: [], next_cursor: null }) : data.page
	);
	const added = $derived(extra && extra.key === key ? extra : null);
	const items = $derived([...base.items, ...(added?.items ?? [])]);
	const cursor = $derived(added ? added.cursor : base.next_cursor);

	async function more() {
		if (!cursor) return;
		try {
			loading = true;
			const next = await loadJournal(api, username, { ...filters, cursor }, isOwner);
			extra = {
				key,
				items: [...(added?.items ?? []), ...next.items],
				cursor: next.next_cursor
			};
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}
</script>

<Seo title="Журнал" noindex />

<JournalFilters filter={filters.filter} kind={filters.kind} q={filters.q} {isOwner} />

{#if error}
	<LoadError message={error} />
{:else if items.length}
	<ul class="flex flex-col gap-3" aria-label="Журнал">
		{#each items as item (item.entity.id)}
			<JournalItemCard {item} />
		{/each}
	</ul>
	{#if cursor}
		<div class="mt-6 text-center">
			<button class="btn btn-outline" disabled={loading} onclick={more}>Показать ещё</button>
		</div>
	{/if}
{:else if loading}
	<div class="h-40 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
{:else}
	<EmptyState title="В журнале пусто">Под эти фильтры ничего не нашлось.</EmptyState>
{/if}
