<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { count, yearOf } from '#lib/catalog/labels.ts';
	import { formUrl } from '#lib/catalog/url.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		goto(formUrl(page.url.pathname, new FormData(event.currentTarget)), { reset: false });
	}
</script>

<Seo
	title={data.q ? `Люди: ${data.q}` : 'Люди'}
	description="Актёры, режиссёры, писатели, композиторы и разработчики игр в каталоге Nexus."
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">Люди</h1>
	{#if data.list.data}
		<p class="mt-1 text-sm text-base-content/50">
			{count(data.list.data.total, ['человек', 'человека', 'человек'])}
		</p>
	{/if}
</header>

<form
	method="GET"
	action="/people"
	onsubmit={submit}
	role="search"
	class="mb-8 flex max-w-lg gap-2"
>
	<input
		type="search"
		name="q"
		value={data.q ?? ''}
		placeholder="Имя"
		aria-label="Поиск по имени"
		class="input w-full"
	/>
	<button class="btn btn-primary">Найти</button>
</form>

{#if data.list.error}
	<LoadError message={data.list.error} />
{:else if data.list.data?.items.length}
	<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
		{#each data.list.data.items as person (person.id)}
			<li>
				<a
					href="/people/{person.slug}"
					class="group flex flex-col items-center gap-3 rounded-box p-3 text-center transition-colors hover:bg-base-200"
				>
					<span class="transition duration-300 group-hover:scale-105">
						<PersonAvatar name={person.full_name} photoUrl={person.photo_url} />
					</span>
					<span>
						<span class="block text-sm font-semibold group-hover:text-primary"
							>{person.full_name}</span
						>
						{#if person.birth_date}
							<span class="block text-xs text-base-content/50">{yearOf(person.birth_date)}</span>
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
	<EmptyState title={data.q ? 'Никого не нашлось' : 'Здесь пока никого нет'}>
		{#if data.q}Проверьте написание имени или <a href="/people" class="link link-primary"
				>посмотрите всех</a
			>.{/if}
	</EmptyState>
{/if}
