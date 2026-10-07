<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPageEntitySummary } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { kindByApi, kindBySlug, KINDS } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import { filterUrl, formUrl, PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// /admin/entities?kind=films&q=дюна&offset=24
	let list = $state<SchemaPageEntitySummary | null>(null);
	let error = $state('');
	const kind = $derived(kindBySlug(readText(page.url, 'kind') ?? ''));
	const q = $derived(readText(page.url, 'q'));

	$effect(() => {
		const query = { kind: kind?.kind, q, limit: PAGE_SIZE, offset: readOffset(page.url) };
		unwrap(api.catalog.GET('/api/v1/catalog/entities', { params: { query } }))
			.then((r) => (list = r))
			.catch((e) => (error = errorMessage(e)));
	});

	function search(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		goto(formUrl(page.url.pathname, new FormData(event.currentTarget)), { reset: false });
	}
</script>

<svelte:head><title>Произведения — Админка — Nexus</title></svelte:head>

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
{#if list}
	<ul class="flex flex-col gap-1" aria-label="Произведения">
		{#each list.items as entity (entity.id)}
			<li>
				<a
					href="/admin/entities/{entity.slug}"
					class="flex items-center gap-3 rounded-box p-2 hover:bg-base-200"
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
					<span class="text-xs whitespace-nowrap text-base-content/40"
						>{kindByApi(entity.kind).one} · {yearOf(entity.release_date) ?? '—'} · {entity.slug}</span
					>
				</a>
			</li>
		{/each}
	</ul>
	<Pagination total={list.total} limit={list.limit} offset={list.offset} />
{/if}
