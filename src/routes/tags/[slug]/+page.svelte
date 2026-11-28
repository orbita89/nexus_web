<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { kindsBySlugs } from '#lib/catalog/kinds.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { ratingsFor, settle } from '#lib/catalog/load.ts';
	import { tagList } from '#lib/catalog/tag-page.ts';
	import { readText } from '#lib/catalog/url.ts';
	import { liveQuery } from '#lib/social/card-live.svelte.ts';
	import type { TagEntry } from '#lib/catalog/tags.ts';
	import { DEFAULT_SORT } from '#lib/catalog/sort.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import KindTabs from '#lib/components/catalog/KindTabs.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import ChatButton from '#lib/components/chat/ChatButton.svelte';
	import WatchButton from '#lib/components/social/WatchButton.svelte';
	import { Watch } from '#lib/social/watch.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Страница статическая (+page.server.ts): в data тег и вкладка по умолчанию. Вкладку из ?kind=
	// читаем только в браузере (nginx отдаёт файл без учёта query) и грузим сами; оценки — тоже.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const asked = $derived(mounted ? kindsBySlugs(readText(page.url, 'kind')) : []);
	const kinds = $derived(asked.length ? asked : data.kinds);
	const key = (list: readonly { slug: string }[]) => list.map((k) => k.slug).join(',');
	const isDefault = $derived(key(kinds) === key(data.kinds));
	const other = liveQuery(
		() => ({ slug: data.tag.slug, kinds: isDefault ? null : kinds }),
		async (q) => ({
			...q,
			list: q.kinds ? await settle(tagList(guestApi, q.slug, q.kinds)) : null
		})
	);
	const answer = $derived(
		other.current?.data?.slug === data.tag.slug && other.current.data.kinds
			? other.current.data
			: null
	);
	const loading = $derived(!isDefault && (!answer || key(answer.kinds!) !== key(kinds)));
	const list = $derived(isDefault ? { data: data.list, error: null } : answer?.list);
	/** Ровно один раздел — только тогда он попадает в заголовок и убирается из карточек. */
	const kind = $derived(kinds.length === 1 ? kinds[0] : undefined);
	const ratingsQuery = liveQuery(
		() => list?.data?.items ?? [],
		(items) => ratingsFor(guestApi, items)
	);
	const ratings = $derived(ratingsQuery.current?.data ?? {});

	const watch = new Watch(
		() => data.tag.slug,
		() => data.tag.id,
		'tags'
	);
	const heading = $derived(kind ? `${data.tag.name} · ${kind.title}` : data.tag.name);
	// description у тега бэкенд ещё не отдаёт (docs/backend-tasks/tags-by-kind.md).
	const about = $derived((data.tag as TagEntry).description || '');
</script>

<Seo
	title={heading}
	description={about ||
		`${data.tag.name}: ${
			kind ? kind.title.toLowerCase() : 'фильмы, сериалы, книги и игры'
		} в каталоге Кассандра.`}
/>

<header class="mb-6">
	{#if data.tag.kind === 'genre'}
		<a href="/genres" class="link text-sm text-primary link-hover">Жанры</a>
	{:else}
		<a href="/tags" class="link text-sm text-primary link-hover">Теги</a>
	{/if}
	<h1 class="mt-1 text-3xl font-black sm:text-4xl">{data.tag.name}</h1>
	<p class="mt-1 text-sm text-base-content/50">
		{count(data.tag.entities_count, ['произведение', 'произведения', 'произведений'])} в каталоге
	</p>
	{#if about}
		<p class="mt-2 max-w-2xl text-sm text-base-content/70">{about}</p>
	{/if}
	<div class="mt-4 flex flex-wrap items-center gap-2">
		<WatchButton {watch} />
		<ChatButton
			meta={{
				room: `tag:${data.tag.slug}`,
				title: data.tag.name,
				href: `/tags/${data.tag.slug}`,
				image: null
			}}
		/>
	</div>
</header>

<div class="mb-8 overflow-x-auto">
	<KindTabs current={kinds} available={data.tag.by_kind} hideAll />
</div>

{#if loading}
	<div class="flex justify-center py-12"><span class="loading loading-spinner"></span></div>
{:else if list?.error}
	<LoadError message={list.error} />
{:else if list?.data?.items.length}
	<EntityGrid
		row={{ filters: { tag: data.tag.slug }, kind: kind?.kind, sort: DEFAULT_SORT }}
		wall={kind?.kind === 'painting'}
		entities={list.data.items}
		showKind={kinds.length !== 1}
		{ratings}
	/>
{:else}
	<EmptyState title="Ничего не нашлось">
		{#if kind}
			В разделе «{kind.title}» с этим тегом пока ничего нет.
			<a href="/tags/{data.tag.slug}" class="link link-primary">Все разделы</a>
		{/if}
	</EmptyState>
{/if}
