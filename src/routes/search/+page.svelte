<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { formUrl, withQuery } from '#lib/catalog/url.ts';
	import Alert from '#lib/components/Alert.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import KindTabs from '#lib/components/catalog/KindTabs.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const EXAMPLES = ['Дюна', 'Стивен Кинг', 'киберпанк', 'Ведьмак'];

	function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		goto(formUrl(page.url.pathname, new FormData(event.currentTarget)), { reset: false });
	}
</script>

<Seo
	title={data.q ? `Поиск: ${data.q}` : 'Поиск'}
	description="Поиск по каталогу Nexus: фильмы, сериалы, книги и игры по названию, людям и тегам."
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
		placeholder="Название, имя, тег"
		aria-label="Что ищем"
		class="input w-full input-lg"
	/>
	{#if data.kind}<input type="hidden" name="kind" value={data.kind.slug} />{/if}
	<button class="btn btn-lg btn-primary">Найти</button>
</form>

{#if data.q}
	<div class="mb-8 overflow-x-auto"><KindTabs current={data.kind?.slug} /></div>
{/if}

{#if !data.q}
	<div class="mt-10 max-w-xl text-base-content/70">
		<p>Ищите по названию, оригинальному названию, именам актёров, режиссёров и авторов, тегам.</p>
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
	<EntityGrid entities={data.result.items} showKind={!data.kind} />
	<Pagination total={data.result.total} limit={data.result.limit} offset={data.result.offset} />
{:else}
	<EmptyState title="Ничего не нашлось">
		По запросу «{data.q}»{data.kind ? ` в разделе «${data.kind.title}»` : ''} ничего нет. Проверьте написание
		или попробуйте другие слова.
	</EmptyState>
{/if}
