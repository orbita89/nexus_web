<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { count, roleLabel } from '#lib/catalog/labels.ts';
	import { filterUrl, withQuery } from '#lib/catalog/url.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import { _PEOPLE_ROLES } from './+page.ts';
	import type { PageProps } from './$types';

	// Люди: поиск по мере ввода (через 300 мс, без новой записи в истории — «брэ» сразу покажет
	// Брэда Питта), фильтр по основной роли. Без запроса — самые известные.
	let { data }: PageProps = $props();

	let text = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const loading = $derived(navigating.to?.url.pathname === page.url.pathname);

	// «Назад», «вперёд», ссылка — поле следует за адресом; свой goto поле не трогает.
	afterNavigate(({ type }) => {
		if (type !== 'goto') text = data.q ?? '';
	});

	function search(delay: number) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (text.trim() === (data.q ?? '')) return;
			goto(filterUrl(page.url, { q: text }), { replace: true, reset: false });
		}, delay);
	}
</script>

<Seo
	title={data.q ? `Люди: ${data.q}` : 'Популярные люди'}
	description="Актёры, режиссёры, сценаристы и композиторы в каталоге Nexus."
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">{data.q ? 'Люди' : 'Популярные люди'}</h1>
	{#if data.list.data && data.q}
		<p class="mt-1 text-sm text-base-content/50">
			Найдено {data.list.data.total > data.list.data.limit ? 'около ' : ''}{count(
				data.list.data.total,
				['человек', 'человека', 'человек']
			)}
		</p>
	{/if}
</header>

<form
	method="GET"
	action="/people"
	onsubmit={(e) => {
		e.preventDefault();
		search(0);
	}}
	role="search"
	class="mb-4 flex max-w-lg gap-2"
>
	{#if data.role}<input type="hidden" name="role" value={data.role} />{/if}
	<input
		type="search"
		name="q"
		bind:value={text}
		oninput={() => search(300)}
		placeholder="Имя — по-русски или латиницей"
		aria-label="Поиск по имени"
		class="input w-full"
	/>
	<button class="btn btn-primary">Найти</button>
</form>

<nav class="mb-8 overflow-x-auto" aria-label="Основная роль">
	<div class="tabs tabs-box w-fit tabs-sm">
		{#each _PEOPLE_ROLES as r (r.title)}
			<a
				href={withQuery('/people', { q: data.q, role: r.value })}
				data-sveltekit-noscroll
				class={['tab', { 'tab-active': r.value === data.role }]}
				aria-current={r.value === data.role ? 'page' : undefined}>{r.title}</a
			>
		{/each}
	</div>
</nav>

<div class={['transition-opacity', { 'opacity-50': loading }]} aria-busy={loading}>
	{#if data.list.error}
		<LoadError message={data.list.error} />
	{:else if data.list.data?.items.length}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{#each data.list.data.items as person (person.id)}
				{@const original =
					person.original_name && person.original_name !== person.full_name
						? person.original_name
						: null}
				<li>
					<a
						href="/people/{person.slug}"
						class="group flex flex-col items-center gap-3 rounded-box p-3 text-center transition-colors hover:bg-base-200"
					>
						<span class="transition duration-300 group-hover:scale-105">
							<PersonAvatar name={person.full_name} photoUrl={person.photo_url} />
						</span>
						<span class="min-w-0">
							<span class="block text-sm font-semibold group-hover:text-primary"
								>{person.full_name}</span
							>
							{#if original}
								<span class="block truncate text-xs text-base-content/50">{original}</span>
							{/if}
							{#if person.known_for}
								<span class="block text-xs text-primary/80">{roleLabel(person.known_for)}</span>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
		<Pagination
			total={data.list.data.total}
			limit={data.list.data.limit}
			offset={data.list.data.offset}
		/>
	{:else}
		<EmptyState title="Никого не нашлось">
			Проверьте написание имени или <a href="/people" class="link link-primary"
				>посмотрите популярных</a
			>.
		</EmptyState>
	{/if}
</div>
