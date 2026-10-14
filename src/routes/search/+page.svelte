<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { hasFilters } from '#lib/catalog/filters.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { formUrl, withQuery } from '#lib/catalog/url.ts';
	import Alert from '#lib/components/Alert.svelte';
	import ArchiveHint from '#lib/components/catalog/ArchiveHint.svelte';
	import CatalogFilters from '#lib/components/catalog/CatalogFilters.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import KindTabs from '#lib/components/catalog/KindTabs.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const EXAMPLES = ['Интерстеллар', 'Дюна', 'Брат', 'Pixar'];
	/** Есть запрос или фильтр — показываем выдачу, иначе подсказки. */
	const searching = $derived(hasFilters({ ...data.filters, archive: false }));

	function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		goto(formUrl(page.url.pathname, new FormData(event.currentTarget)), { reset: false });
	}
</script>

<Seo
	title={data.q ? `Поиск: ${data.q}` : 'Поиск'}
	description="Поиск фильмов в Nexus по названию, оригинальному названию и студии."
/>

<h1 class="mb-6 text-3xl font-black sm:text-4xl">{data.q ? `Поиск: ${data.q}` : 'Поиск'}</h1>

<form
	method="GET"
	action="/search"
	onsubmit={submit}
	role="search"
	class="mb-4 flex max-w-2xl gap-2"
>
	<input
		type="search"
		name="q"
		value={data.q ?? ''}
		placeholder="Название фильма или студия"
		aria-label="Что ищем"
		class="input w-full input-lg"
	/>
	<!-- Новый запрос не сбрасывает раздел и фильтры. -->
	{#each ['kind', 'tag', 'year', 'year_from', 'year_to', 'studio', 'person', 'role'] as key (key)}
		{@const value = page.url.searchParams.get(key)}
		{#if value}<input type="hidden" name={key} {value} />{/if}
	{/each}
	<button class="btn btn-lg btn-primary">Найти</button>
</form>

<CatalogFilters
	kind={data.kind}
	path="/search"
	filters={data.filters}
	personName={data.personName}
	tags={data.tags}
	titleField={false}
	archiveField={false}
/>

{#if data.personUnavailable}
	<div class="mb-4">
		<Alert kind="info">
			Фильтр по людям скоро заработает. Пока показаны фильмы по остальным фильтрам.
		</Alert>
	</div>
{/if}

{#if searching}
	<div class="mb-8 overflow-x-auto"><KindTabs current={data.kind?.slug} /></div>
{/if}

{#if !searching}
	<div class="mt-10 max-w-xl text-base-content/70">
		<p>Ищите фильмы по названию — русскому или оригинальному — и по студии.</p>
		<p class="mt-4 text-sm text-base-content/50">Например:</p>
		<ul class="mt-2 flex flex-wrap gap-2">
			{#each EXAMPLES as example (example)}
				<li>
					<a href={withQuery('/search', { q: example })} class="btn btn-outline btn-sm">{example}</a
					>
				</li>
			{/each}
		</ul>
		<p class="mt-6 text-sm">
			Или откройте раздел:
			{#each KINDS as k, i (k.slug)}{i ? ', ' : ' '}<a href="/{k.slug}" class="link link-primary"
					>{k.title.toLowerCase()}</a
				>{/each}.
		</p>
	</div>
{:else if data.unavailable}
	<Alert kind="warning">
		Поиск временно недоступен. Попробуйте чуть позже — а пока можно посмотреть
		<a href="/films" class="link">разделы каталога</a> или <a href="/tags" class="link">теги</a>.
	</Alert>
{:else if data.error}
	<LoadError message={data.error} />
{:else if data.result?.items.length}
	<p class="mb-4 text-sm text-base-content/50">
		Найдено {data.result.total > data.result.limit ? 'около ' : ''}{count(data.result.total, [
			'произведение',
			'произведения',
			'произведений'
		])}
	</p>
	<EntityGrid entities={data.result.items} showKind={!data.kind} ratings={data.ratings} />
	<Pagination total={data.result.total} limit={data.result.limit} offset={data.result.offset} />
{:else}
	<EmptyState title="Ничего не нашлось">
		{data.q ? `По запросу «${data.q}»` : 'По этим фильтрам'}{data.kind
			? ` в разделе «${data.kind.title}»`
			: ''} ничего нет. Проверьте написание или измените фильтры.
	</EmptyState>
{/if}

{#if data.archive.length}<ArchiveHint docs={data.archive} />{/if}
