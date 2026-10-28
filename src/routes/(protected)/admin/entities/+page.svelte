<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPageAdminEntitySummary } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { kindByApi, kindBySlug, KINDS } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import { filterUrl, formUrl, PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
	import { DEMOTE_LIMIT } from '#lib/admin/demote.ts';
	import Alert from '#lib/components/Alert.svelte';
	import DemoteDialog from '#lib/components/admin/DemoteDialog.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// /admin/entities?kind=films&q=дюна&offset=24 — все сущности, включая скрытые с сайта.
	// Фильмы можно отметить (выбор живёт и при переходе по страницам) и перенести в архив — до
	// DEMOTE_LIMIT за раз.
	let list = $state<SchemaPageAdminEntitySummary | null>(null);
	let error = $state('');
	let reloads = $state(0);
	const kind = $derived(kindBySlug(readText(page.url, 'kind') ?? ''));
	const q = $derived(readText(page.url, 'q'));
	/** Отмеченные: slug → название (для итога переноса). */
	const picked = new SvelteMap<string, string>();
	let demote = $state<ReturnType<typeof DemoteDialog>>();

	$effect(() => {
		void reloads;
		const query = { kind: kind?.kind, q, limit: PAGE_SIZE, offset: readOffset(page.url) };
		unwrap(api.catalog.GET('/api/v1/catalog/admin/entities', { params: { query } }))
			.then((r) => (list = r))
			.catch((e) => (error = errorMessage(e)));
	});

	/** В архив — только фильмы (архив — фильмы TMDB). */
	const movies = $derived(list?.items.filter((e) => e.kind === 'movie') ?? []);
	const allPicked = $derived(movies.length > 0 && movies.every((e) => picked.has(e.slug)));

	function toggle(slug: string, title: string, on: boolean) {
		if (on && picked.size < DEMOTE_LIMIT) picked.set(slug, title);
		else picked.delete(slug);
	}

	function toggleAll(on: boolean) {
		for (const e of movies) toggle(e.slug, e.title, on);
	}

	function search(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		goto(formUrl(page.url.pathname, new FormData(event.currentTarget)), { reset: false });
	}
</script>

<svelte:head><title>Произведения — Админка — Кассандра</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<h1 class="text-3xl font-black">Произведения</h1>
	<details class="dropdown dropdown-end">
		<summary class="btn btn-primary">Добавить</summary>
		<ul
			class="menu dropdown-content z-10 mt-2 w-44 rounded-box bg-base-200 shadow-xl ring-1 ring-base-300"
		>
			{#each KINDS as k (k.kind)}
				<li><a href="/admin/entities/new?kind={k.kind}">{k.one}</a></li>
			{/each}
		</ul>
	</details>
</div>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<nav class="tabs tabs-box tabs-sm" aria-label="Раздел">
		{#each [{ slug: undefined, title: 'Все' }, ...KINDS] as k (k.slug ?? 'all')}
			<a
				href={filterUrl(page.url, { kind: k.slug })}
				class={['tab', { 'tab-active': k.slug === kind?.slug }]}>{k.title}</a
			>
		{/each}
	</nav>
	<form class="flex gap-2" role="search" onsubmit={search}>
		{#if kind}<input type="hidden" name="kind" value={kind.slug} />{/if}
		<input
			type="search"
			name="q"
			value={q ?? ''}
			placeholder="Название"
			aria-label="Поиск по названию"
			class="input w-56 input-sm"
		/>
		<button class="btn btn-sm">Найти</button>
	</form>
</div>

{#if error}<Alert>{error}</Alert>{/if}
{#if picked.size}
	<div
		class="sticky top-20 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-box bg-base-200 p-2 shadow-md ring-1 ring-base-300"
		role="toolbar"
		aria-label="Отмеченные"
	>
		<span class="px-2 text-sm"
			>Отмечено: {picked.size}{picked.size >= DEMOTE_LIMIT
				? ` (не больше ${DEMOTE_LIMIT} за раз)`
				: ''}</span
		>
		<button class="btn btn-sm btn-warning" onclick={() => demote?.open()}>В архив</button>
		<button class="btn btn-ghost btn-sm" onclick={() => picked.clear()}>Снять отметки</button>
	</div>
{/if}

<DemoteDialog
	bind:this={demote}
	slugs={[...picked.keys()]}
	titles={Object.fromEntries(picked)}
	onclose={(result) => {
		if (!result) return;
		for (const slug of result.archived) picked.delete(slug);
		reloads++;
	}}
/>

{#if list}
	{#if movies.length}
		<label
			class="mb-1 flex w-fit cursor-pointer items-center gap-2 px-2 text-sm text-base-content/60"
		>
			<input
				type="checkbox"
				class="checkbox checkbox-sm"
				checked={allPicked}
				onchange={(e) => toggleAll(e.currentTarget.checked)}
			/>
			Отметить все фильмы на странице
		</label>
	{/if}
	<ul class="flex flex-col gap-1" aria-label="Произведения">
		{#each list.items as entity (entity.id)}
			<li class="flex items-center gap-1">
				<span class="flex w-8 shrink-0 justify-center">
					{#if entity.kind === 'movie'}
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							aria-label="Отметить: {entity.title}"
							checked={picked.has(entity.slug)}
							disabled={!picked.has(entity.slug) && picked.size >= DEMOTE_LIMIT}
							onchange={(e) => toggle(entity.slug, entity.title, e.currentTarget.checked)}
						/>
					{/if}
				</span>
				<a
					href="/admin/entities/{entity.slug}"
					class="flex min-w-0 flex-1 items-center gap-3 rounded-box p-2 hover:bg-base-200"
				>
					<span class="w-8 shrink-0"
						><Poster
							title={entity.title}
							kind={entity.kind}
							coverUrl={entity.cover_url}
							small
						/></span
					>
					<span class="min-w-0 flex-1 truncate font-medium">{entity.title}</span>
					{#if !entity.visible}<span class="badge badge-ghost badge-sm">скрыто</span>{/if}
					{#if entity.active_manual}<span
							class="badge badge-outline badge-sm badge-info"
							title="Включено или скрыто вручную: «пересобрать активные» не трогает">вручную</span
						>{/if}
					<span class="text-xs whitespace-nowrap text-base-content/40"
						>{kindByApi(entity.kind).one} · {yearOf(entity.release_date) ?? '—'} · {entity.slug}</span
					>
				</a>
			</li>
		{/each}
	</ul>
	<Pagination total={list.total} limit={list.limit} offset={list.offset} />
{/if}
