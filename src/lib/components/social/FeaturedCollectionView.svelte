<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaCollectionDetail } from '#lib/api/generated/social.ts';
	import { asKind, refHref } from '#lib/catalog/kinds.ts';
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
	import { resolveFeaturedLook } from '#lib/social/featuredThemes.ts';
	import { reviewDate } from '#lib/social/reviews.ts';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import type { Snippet } from 'svelte';

	// Особая коллекция («Топ-10»): нумерованный рейтинг и полная SEO-разметка. Не зависит от
	// маршрута — при переезде на /top/{slug} переносится как есть.
	let { collection, actions }: { collection: SchemaCollectionDetail; actions?: Snippet } = $props();

	const origin = $derived(page.url.origin);
	const canonical = $derived(origin + buildFeaturedUrl(collection));
	const title = $derived(`${featuredTitle(collection)} | Nexus`);
	const description = $derived(featuredDescription(collection));
	const look = $derived(resolveFeaturedLook(collection));
	const image = $derived(
		(look.kind === 'cover' ? look.url : null) ??
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
	const tier = (rank: number) => (rank === 1 ? 'gold' : rank <= 3 ? 'podium' : 'regular');
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

<header
	class="relative isolate mb-8 overflow-hidden rounded-box bg-linear-to-br p-5 ring-1 sm:p-8 {look
		.theme.gradient} {look.theme.ring}"
>
	{#if look.kind === 'cover'}
		<img
			src={look.url}
			alt=""
			class="absolute inset-0 -z-20 h-full w-full object-cover opacity-30"
			fetchpriority="high"
		/>
	{:else if look.kind === 'collage'}
		<div
			class="absolute inset-y-0 right-0 -z-20 hidden w-1/2 grid-cols-4 gap-2 p-3 opacity-25 sm:grid"
			aria-hidden="true"
		>
			{#each collection.items.slice(0, 4) as item (item.entity.id)}
				{#if item.entity.cover_url}
					<img src={item.entity.cover_url} alt="" class="h-full w-full rounded-box object-cover" />
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
	<nav aria-label="Хлебные крошки" class="text-sm">
		<a href="/" class="link text-primary link-hover">Главная</a>
		<span class="text-base-content/40">/</span>
		<a href="/collections" class="link text-primary link-hover">Коллекции</a>
	</nav>
	<span class="mt-3 badge {look.theme.badge}">{featuredBadge(collection.title)}</span>
	<h1 class="mt-2 text-3xl font-black sm:text-4xl">{collection.title}</h1>
	{#if collection.description}
		<p class="mt-2 max-w-2xl whitespace-pre-line text-base-content/70">{collection.description}</p>
	{/if}
	<div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-base-content/60">
		<span class="font-semibold text-base-content">Редакция</span>
		<span>·</span>
		<span>{count(collection.items_count, ['произведение', 'произведения', 'произведений'])}</span>
		<span>·</span>
		<span>обновлена {reviewDate(collection.updated_at)}</span>
	</div>
	{@render actions?.()}
</header>

{#if items.length}
	<ol
		class="flex max-w-4xl flex-col gap-6 sm:gap-8"
		reversed
		aria-label="Рейтинг: от {total}-го места к первому"
	>
		{#each items as { item, rank, kind, href }, i (item.entity.id)}
			{@const t = tier(rank)}
			{@const year = yearOf(item.entity.release_date)}
			<li
				value={rank}
				class={[
					'flex flex-col gap-4 rounded-box p-4 sm:flex-row sm:gap-6 sm:p-6',
					t === 'gold'
						? 'bg-primary/10 shadow-xl ring-2 ring-primary sm:p-8'
						: t === 'podium'
							? 'bg-base-200 ring-2 ring-primary/50'
							: 'bg-base-200 ring-1 ring-base-300'
				]}
			>
				<div class="flex shrink-0 items-start gap-4">
					<span
						class={[
							'w-16 text-center leading-none font-black tabular-nums sm:w-24',
							t === 'gold'
								? 'text-7xl text-primary sm:text-9xl'
								: t === 'podium'
									? 'text-6xl text-primary sm:text-8xl'
									: 'text-5xl text-primary/70 sm:text-7xl'
						]}
						aria-hidden="true">{rank}</span
					>
					<div
						class={t === 'gold' ? 'w-40 sm:w-56' : t === 'podium' ? 'w-36 sm:w-48' : 'w-32 sm:w-40'}
					>
						{#if kind}
							<Poster
								title={item.entity.title}
								{kind}
								coverUrl={item.entity.cover_url}
								eager={i < 2}
							/>
						{/if}
					</div>
				</div>
				<div class="min-w-0 flex-1">
					<h2
						class={t === 'gold'
							? 'text-2xl font-black sm:text-4xl'
							: 'text-xl font-bold sm:text-2xl'}
					>
						<span class="sr-only">{rank} место. </span>
						{#if href}
							<a {href} class="link link-hover">{item.entity.title}</a>
						{:else}
							{item.entity.title}
						{/if}
					</h2>
					{#if year}
						<p class="text-sm text-base-content/60">{year}</p>
					{/if}
					{#if item.note}
						<blockquote class="mt-3 border-l-4 border-primary/50 pl-3 text-base-content/80 italic">
							<p class="line-clamp-4" title={item.note}>{truncate(item.note)}</p>
							<footer class="mt-1 text-xs text-base-content/50 not-italic">— Редакция</footer>
						</blockquote>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
{:else}
	<p class="text-base-content/60">В подборке пока ничего нет.</p>
{/if}
