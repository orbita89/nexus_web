<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaCollectionDetail } from '#lib/api/generated/social.ts';
	import { asKind, kindByApi, refHref } from '#lib/catalog/kinds.ts';
	import { count, yearOf } from '#lib/catalog/labels.ts';
	import { featuredBadge } from '#lib/social/collections.ts';
	import {
		buildFeaturedUrl,
		featuredDescription,
		featuredJsonLd,
		featuredTitle,
		jsonLdScript,
		truncate
	} from '#lib/social/featured.ts';
	import {
		collectionCoverUrl,
		collectionThemeId,
		collectionWallpaperUrl,
		resolveFeaturedHero
	} from '#lib/social/featuredThemes.ts';
	import { reviewDate } from '#lib/social/reviews.ts';
	import CollectionBackdrop from '#lib/components/social/CollectionBackdrop.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import type { Snippet } from 'svelte';

	// Особая коллекция («Топ-10»): нумерованный рейтинг и полная SEO-разметка. Не зависит от
	// маршрута — при переезде на /top/{slug} переносится как есть.
	// actions — панель под шапкой (вне overflow-hidden, чтобы выпадающий поиск не обрезался).
	let { collection, actions }: { collection: SchemaCollectionDetail; actions?: Snippet } = $props();

	const origin = $derived(page.url.origin);
	const canonical = $derived(origin + buildFeaturedUrl(collection));
	const title = $derived(`${featuredTitle(collection)} | Nexus`);
	const description = $derived(featuredDescription(collection));
	const look = $derived(resolveFeaturedHero(collection));
	// og:image: обложка → обои → обложка первого произведения.
	const image = $derived(
		collectionCoverUrl(collection) ??
			collectionWallpaperUrl(collection) ??
			collection.items.find((i) => i.entity.cover_url)?.entity.cover_url ??
			null
	);
	const ld = $derived(jsonLdScript(featuredJsonLd(collection, origin)));
	// Обратный отсчёт: сверху худшее место (#N), внизу — #1. items приходят по месту (1 — лучший).
	const total = $derived(collection.items.length);
	const items = $derived(
		collection.items
			.map((item, i) => ({
				item,
				rank: i + 1,
				kind: asKind(item.entity.kind),
				href: refHref(item.entity)
			}))
			.reverse()
	);
	// Раскрытые описания по id сущности.
	let expanded = $state<Record<string, boolean>>({});
	const DESCRIPTION_LIMIT = 600;
	// Описание произведения: бэкенд отдаёт чистый текст до 1000 символов (уже обрезан).
	const entityDescription = (overview: string | null | undefined): string | null =>
		overview?.trim() || null;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Nexus" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	{#if image}<meta property="og:image" content={image} />{/if}
	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if image}<meta name="twitter:image" content={image} />{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON экранирован в jsonLdScript -->
	{@html ld}
</svelte:head>

<CollectionBackdrop
	themeId={collectionThemeId(collection)}
	wallpaperUrl={collectionWallpaperUrl(collection)}
/>
<div class="relative z-10">
	<header
		class="relative isolate overflow-hidden rounded-box bg-linear-to-br p-5 sm:p-8 {look.theme
			.gradient}"
	>
		{#if look.kind === 'cover'}
			<img
				src={look.url}
				alt=""
				class="absolute inset-0 -z-30 h-full w-full object-cover"
				fetchpriority="high"
			/>
			<!-- Затемнение слева направо и снизу: текст читается на любых обоях. -->
			<div
				class="absolute inset-0 -z-20 bg-linear-to-r from-base-100 via-base-100/80 to-base-100/20"
				aria-hidden="true"
			></div>
			<div
				class="absolute inset-0 -z-20 bg-linear-to-t from-base-100/70 to-transparent"
				aria-hidden="true"
			></div>
		{:else if look.kind === 'collage'}
			<div
				class="absolute inset-y-0 right-0 -z-20 hidden w-1/2 grid-cols-4 gap-2 p-3 opacity-25 sm:grid"
				aria-hidden="true"
			>
				{#each collection.items.slice(0, 4) as item (item.entity.id)}
					{#if item.entity.cover_url}
						<img
							src={item.entity.cover_url}
							alt=""
							class="h-full w-full rounded-box object-cover"
						/>
					{/if}
				{/each}
			</div>
		{/if}
		{#if look.theme.pattern}
			<div
				class="pointer-events-none absolute inset-0 -z-10"
				style:background={look.theme.pattern}
				aria-hidden="true"
			></div>
		{/if}
		<h1 class="flex items-start gap-2 text-3xl font-black sm:text-4xl">
			<span
				class="mt-1 shrink-0 text-2xl text-warning sm:text-3xl"
				role="img"
				aria-label={featuredBadge(collection.title)}
				title={featuredBadge(collection.title)}>★</span
			>
			<span>{collection.title}</span>
		</h1>
		{#if collection.description}
			<p class="mt-2 max-w-2xl whitespace-pre-line text-base-content/70">
				{collection.description}
			</p>
		{/if}
		<p class="mt-4 text-sm text-base-content/60">
			{count(collection.items_count, ['произведение', 'произведения', 'произведений'])}
		</p>
		<p class="mt-2 text-right text-xs text-base-content/45">
			обновлена {reviewDate(collection.updated_at)}
		</p>
	</header>
	<div class="relative z-30 mb-8">{@render actions?.()}</div>

	{#if items.length}
		<ol class="max-w-4xl" reversed aria-label="Рейтинг: от {total}-го места к первому">
			{#each items as { item, rank, kind, href }, i (item.entity.id)}
				{@const year = yearOf(item.entity.release_date)}
				{@const kindLabel = kind ? kindByApi(kind)?.one : null}
				{@const about = entityDescription(item.entity.overview)}
				{@const open = expanded[item.entity.id] ?? false}
				<li
					value={rank}
					class="flex gap-3 border-t border-base-content/10 py-8 first:border-t-0 first:pt-0 sm:gap-5 sm:py-10"
				>
					<span
						class={[
							'w-8 shrink-0 pt-0.5 text-right text-2xl leading-none font-semibold tabular-nums sm:w-10 sm:text-3xl',
							rank <= 3 ? 'text-primary' : 'text-base-content/40'
						]}
						aria-hidden="true">{rank}</span
					>
					<div class="w-32 shrink-0 overflow-hidden rounded-box sm:w-40 md:w-48">
						{#if kind}
							<Poster
								title={item.entity.title}
								{kind}
								coverUrl={item.entity.cover_url}
								eager={i < 2}
							/>
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<h2 class="text-lg leading-snug font-bold sm:text-xl">
							<span class="sr-only">{rank} место. </span>
							{#if href}
								<a {href} class="link link-hover">{item.entity.title}</a>
							{:else}
								{item.entity.title}
							{/if}
						</h2>
						{#if year || kindLabel}
							<p class="mt-1 text-sm text-base-content/55">
								{[year, kindLabel].filter(Boolean).join(' · ')}
							</p>
						{/if}
						{#if about}
							<p
								class={[
									'mt-3 text-sm leading-relaxed text-base-content/80',
									!open && 'line-clamp-6'
								]}
							>
								{open ? about : truncate(about, DESCRIPTION_LIMIT)}
							</p>
						{/if}
						{#if item.note}
							<p
								class={[
									'mt-3 text-sm leading-relaxed whitespace-pre-line text-base-content/70',
									!open && 'line-clamp-6'
								]}
							>
								{open ? item.note : truncate(item.note, DESCRIPTION_LIMIT)}
							</p>
						{/if}
						{#if (about?.length ?? 0) + (item.note?.length ?? 0) > 280}
							<button
								type="button"
								class="mt-2 text-sm text-primary hover:underline"
								aria-expanded={open}
								onclick={() => (expanded[item.entity.id] = !open)}
							>
								{open ? 'Свернуть' : 'Ещё'}
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="text-base-content/60">В подборке пока ничего нет.</p>
	{/if}
</div>
