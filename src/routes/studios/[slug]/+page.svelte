<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { countryName, count } from '#lib/catalog/labels.ts';
	import { ratingsFor, settle } from '#lib/catalog/load.ts';
	import { DEFAULT_SORT, LIST_SORTS, readListSort } from '#lib/catalog/sort.ts';
	import { countryFlag, homepageLabel, studioFilms, studioHref } from '#lib/catalog/studios.ts';
	import { filterUrl } from '#lib/catalog/url.ts';
	import Clamp from '#lib/components/catalog/Clamp.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import ResultsFeed from '#lib/components/catalog/ResultsFeed.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import StudioLogo from '#lib/components/catalog/StudioLogo.svelte';
	import { liveQuery } from '#lib/social/card-live.svelte.ts';
	import type { PageProps } from './$types';

	// Студия: шапка (логотип, страна, штаб-квартира, сайт, материнская компания, описание) и её
	// фильмы — выдача каталога с выбором порядка и «Показать ещё». Страница статическая
	// (+page.server.ts): в data студия и первая порция в порядке по умолчанию. Порядок из ?sort=
	// читаем только в браузере (nginx отдаёт файл без учёта query) и грузим выдачу сами; оценки
	// Nexus — тоже в браузере.
	let { data }: PageProps = $props();

	const studio = $derived(data.studio);
	const homepage = $derived(studio.homepage ? homepageLabel(studio.homepage) : null);
	const parentHref = $derived(studio.parent ? studioHref(studio.parent.slug) : null);

	let mounted = $state(false);
	onMount(() => (mounted = true));
	const sort = $derived(mounted ? readListSort(page.url) : DEFAULT_SORT);

	// Ответ помечен студией и порядком: пока идёт новый запрос, видно, что на экране — прежний.
	const sorted = liveQuery(
		() => ({ slug: studio.slug, name: studio.name, sort }),
		async (key) => ({
			...key,
			list:
				key.sort === DEFAULT_SORT
					? null
					: await settle(studioFilms(guestApi, key.name, key.sort, 0))
		})
	);
	const answer = $derived(sorted.current?.data?.slug === studio.slug ? sorted.current.data : null);
	const loading = $derived(sort !== DEFAULT_SORT && answer?.sort !== sort);
	const error = $derived(!loading && answer?.sort === sort ? (answer.list?.error ?? null) : null);
	/** Выдача на экране: пока грузится другой порядок — прежняя, приглушённая. */
	const first = $derived(sort === DEFAULT_SORT ? data.films : (answer?.list?.data ?? data.films));
	const ratings = liveQuery(
		() => first,
		(list) => ratingsFor(guestApi, list.items)
	);

	const more = (offset: number) => studioFilms(guestApi, studio.name, sort, offset);

	function sortBy(value: string) {
		goto(filterUrl(page.url, { sort: value === DEFAULT_SORT ? null : value }), { reset: false });
	}
</script>

<Seo
	title={studio.name}
	description="{studio.name}: {count(studio.entities_count, [
		'фильм',
		'фильма',
		'фильмов'
	])} студии в каталоге Nexus — оценки, рецензии и обсуждения."
	image={studio.logo_url}
/>

<header class="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
	<StudioLogo url={studio.logo_url} size="lg" />
	<div class="min-w-0 flex-1">
		<p class="text-xs font-semibold tracking-widest text-primary uppercase">Студия</p>
		<h1 class="mt-1 text-3xl font-black break-words sm:text-5xl">{studio.name}</h1>
		<p class="mt-1 text-sm text-base-content/50">
			{count(studio.entities_count, ['фильм', 'фильма', 'фильмов'])} в каталоге
		</p>

		{#if studio.origin_country || studio.headquarters || homepage || studio.parent}
			<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
				{#if studio.origin_country}
					<dt class="text-base-content/50">Страна</dt>
					<dd>
						<span aria-hidden="true">{countryFlag(studio.origin_country)}</span>
						{countryName(studio.origin_country)}
					</dd>
				{/if}
				{#if studio.headquarters}
					<dt class="text-base-content/50">Штаб-квартира</dt>
					<dd>{studio.headquarters}</dd>
				{/if}
				{#if homepage}
					<dt class="text-base-content/50">Сайт</dt>
					<dd class="min-w-0 truncate">
						<a
							href={studio.homepage}
							target="_blank"
							rel="noopener external"
							class="link link-primary link-hover">{homepage}</a
						>
					</dd>
				{/if}
				{#if studio.parent && parentHref}
					<dt class="text-base-content/50">Входит в</dt>
					<dd>
						<a
							href={parentHref}
							class="inline-flex link items-center gap-1.5 link-hover"
							aria-busy={navigating.to?.url.pathname === parentHref}
						>
							{#if navigating.to?.url.pathname === parentHref}
								<span class="loading loading-xs loading-spinner"></span>
							{:else}
								<StudioLogo url={studio.parent.logo_url} />
							{/if}
							{studio.parent.name}
						</a>
					</dd>
				{/if}
			</dl>
		{/if}

		{#if studio.description}
			<Clamp class="mt-4 max-w-2xl leading-relaxed whitespace-pre-line text-base-content/80">
				{studio.description}
			</Clamp>
		{/if}
	</div>
</header>

<section aria-labelledby="films-title">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<h2 id="films-title" class="flex items-center gap-2 text-xl font-bold">
			Фильмы студии
			{#if loading}<span class="loading loading-xs loading-spinner" aria-label="Загружаем…"
				></span>{/if}
		</h2>
		{#if data.films.total}
			<label class="select w-auto select-sm">
				<span class="label">Сортировка</span>
				<select
					aria-label="Сортировка"
					value={sort}
					onchange={(e) => sortBy(e.currentTarget.value)}
				>
					{#each LIST_SORTS as option (option.value)}
						<option value={option.value}>{option.title}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>

	<div
		class={['transition-opacity', { 'pointer-events-none opacity-40': loading }]}
		aria-busy={loading}
	>
		{#if error}
			<LoadError message={error} onretry={sorted.retry} />
		{:else if first.items.length}
			<ResultsFeed {first} {more} ratings={ratings.current?.data ?? {}} showKind />
		{:else if sort === DEFAULT_SORT}
			<EmptyState title="Фильмов пока нет">У этой студии в каталоге пока нет фильмов.</EmptyState>
		{:else}
			<EmptyState title="Ничего не нашлось">
				В этом порядке фильмов нет — например, «Скоро» показывает только ещё не вышедшие.
				<a href={studioHref(studio.slug)} class="link link-primary">Все фильмы студии</a>
			</EmptyState>
		{/if}
	</div>
</section>
