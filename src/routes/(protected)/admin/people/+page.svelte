<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPagePersonSummary } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import { formUrl, PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';

	let list = $state<SchemaPagePersonSummary | null>(null);
	let error = $state('');
	const q = $derived(readText(page.url, 'q'));

	$effect(() => {
		const query = { q, limit: PAGE_SIZE, offset: readOffset(page.url) };
		unwrap(api.catalog.GET('/api/v1/catalog/people', { params: { query } }))
			.then((r) => (list = r))
			.catch((e) => (error = errorMessage(e)));
	});

	function search(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		goto(formUrl(page.url.pathname, new FormData(event.currentTarget)), { reset: false });
	}
</script>

<svelte:head><title>Люди — Админка — Nexus</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<h1 class="text-3xl font-black">Люди</h1>
	<a href="/admin/people/new" class="btn btn-primary">Добавить человека</a>
</div>
<form class="mb-4 flex max-w-md gap-2" role="search" onsubmit={search}>
	<input
		type="search"
		name="q"
		value={q ?? ''}
		placeholder="Имя"
		aria-label="Поиск по имени"
		class="input w-full input-sm"
	/>
	<button class="btn btn-sm">Найти</button>
</form>
{#if error}<Alert>{error}</Alert>{/if}
{#if list}
	<ul class="flex flex-col gap-1" aria-label="Люди">
		{#each list.items as person (person.id)}
			<li>
				<a
					href="/admin/people/{person.slug}"
					class="flex items-center gap-3 rounded-box p-2 hover:bg-base-200"
				>
					<PersonAvatar name={person.full_name} photoUrl={person.photo_url} size="sm" />
					<span class="font-medium">{person.full_name}</span>
					<span class="text-xs text-base-content/40"
						>{yearOf(person.birth_date) ?? ''} · {person.slug}</span
					>
				</a>
			</li>
		{/each}
	</ul>
	<Pagination total={list.total} limit={list.limit} offset={list.offset} />
{/if}
