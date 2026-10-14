<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { hasFilters } from '#lib/catalog/filters.ts';
	import { searchPage } from '#lib/catalog/search.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { filterUrl, formUrl, PAGE_SIZE, withQuery } from '#lib/catalog/url.ts';
	import Alert from '#lib/components/Alert.svelte';
	import CatalogFilters from '#lib/components/catalog/CatalogFilters.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import KindTabs from '#lib/components/catalog/KindTabs.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import PersonHitCard from '#lib/components/catalog/PersonHitCard.svelte';
	import ResultsFeed from '#lib/components/catalog/ResultsFeed.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TitleSearch from '#lib/components/catalog/TitleSearch.svelte';
	import { _ARCHIVE_PAGE } from './+page.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const EXAMPLES = ['Интерстеллар', 'Дюна', 'Брат', 'Pixar'];
	/** Есть запрос или фильтр — показываем выдачу, иначе подсказки. */
	const searching = $derived(hasFilters(data.filters));
	const archiveKind = $derived(!data.kind || data.kind.kind === 'movie');
	/** Архив по запросу: в той же выдаче, после фильмов сайта. */
	const archive = $derived(
		data.archive?.data && data.q ? { q: data.q, first: data.archive.data } : null
	);
	const more = (offset: number) =>
		searchPage(guestApi, data.filters, { kind: data.kind?.kind, limit: PAGE_SIZE, offset }).then(
			(r) => r.page
		);

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
	<TitleSearch
		value={data.q ?? ''}
		placeholder="Название фильма или студия"
		label="Что ищем"
		class="input w-full input-lg"
	/>
	<!-- Новый запрос не сбрасывает раздел и фильтры. -->
	{#each ['kind', 'tag', 'year', 'year_from', 'year_to', 'studio', 'person', 'role', 'archive'] as key (key)}
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
	archiveField={archiveKind}
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

{#if data.people.length}
	<section class="mb-10" aria-labelledby="people-results">
		<div class="mb-3 flex items-baseline justify-between gap-3">
			<h2 id="people-results" class="text-xl font-bold">Люди</h2>
			<a href={withQuery('/people', { q: data.q })} class="link text-sm link-primary">Все люди</a>
		</div>
		<ul class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.people as person (person.id)}<li><PersonHitCard {person} /></li>{/each}
		</ul>
	</section>
{/if}

{#if !searching}
	<div class="mt-10 max-w-xl text-base-content/70">
		<p>Ищите фильмы по названию — русскому или оригинальному — и по студии, людей — по имени.</p>
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
{:else if data.result && (data.result.items.length || archive?.first.items.length)}
	<p class="mb-4 text-sm text-base-content/50">
		Найдено {data.result.total > data.result.limit ? 'около ' : ''}{count(data.result.total, [
			'произведение',
			'произведения',
			'произведений'
		])}{archive?.first.total
			? ` · в архиве ещё ${archive.first.total.toLocaleString('ru-RU')}`
			: ''}
	</p>
	<ResultsFeed
		first={data.result}
		{more}
		ratings={data.ratings}
		{archive}
		archivePage={_ARCHIVE_PAGE}
		showKind={!data.kind}
	/>
{:else}
	<EmptyState title="Ничего не нашлось">
		{data.q ? `По запросу «${data.q}»` : 'По этим фильтрам'}{data.kind
			? ` в разделе «${data.kind.title}»`
			: ''} ничего нет. Проверьте написание или измените фильтры.
	</EmptyState>
{/if}

{#if data.q && archiveKind && !data.filters.archive && searching && !data.result?.items.length}
	<p class="mt-6 text-sm text-base-content/60">
		Возможно, фильм есть в архиве —
		<a href={filterUrl(page.url, { archive: null })} class="link link-primary">поискать в архиве</a
		>.
	</p>
{/if}
