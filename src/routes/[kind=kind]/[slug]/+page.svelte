<script lang="ts">
	import { page } from '$app/state';
	import { kindByApi } from '#lib/catalog/kinds.ts';
	import {
		ageRating,
		formatDate,
		keyFacts,
		leadCredits,
		metadataFields,
		roleLabel,
		summary,
		yearOf
	} from '#lib/catalog/labels.ts';
	import { trailerSources } from '#lib/catalog/trailer.ts';
	import CardHero from '#lib/components/catalog/CardHero.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagChips from '#lib/components/catalog/TagChips.svelte';
	import TrailerButton from '#lib/components/catalog/TrailerButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { count } from '#lib/catalog/labels.ts';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import RatingSummary from '#lib/components/catalog/RatingSummary.svelte';
	import MyReview from '#lib/components/social/MyReview.svelte';
	import { withQuery } from '#lib/catalog/url.ts';
	import { sortParam } from '#lib/social/reviews.ts';
	import RatingBadge from '#lib/components/social/RatingBadge.svelte';
	import ReviewItem from '#lib/components/social/ReviewItem.svelte';
	import ReviewSortTabs from '#lib/components/social/ReviewSortTabs.svelte';
	import NewThreadButton from '#lib/components/social/NewThreadButton.svelte';
	import ThreadItem from '#lib/components/social/ThreadItem.svelte';
	import AddToCollection from '#lib/components/social/AddToCollection.svelte';
	import CollectionCard from '#lib/components/social/CollectionCard.svelte';
	import type { PageProps } from './$types';

	// Карточка как у Okko: трейлер — фон шапки, поверх — название, факты, описание и кнопки.
	// Постера на карточке нет: он — в сетках разделов.
	let { data }: PageProps = $props();

	let hero = $state<CardHero>();

	const entity = $derived(data.entity);
	const kind = $derived(kindByApi(entity.kind));
	const year = $derived(yearOf(entity.release_date));
	const trailers = $derived(trailerSources(entity));
	const facts = $derived([
		...keyFacts(entity.kind, entity.metadata, entity.release_date).slice(0, 1),
		...entity.tags.slice(0, 2).map((t) => t.name),
		...keyFacts(entity.kind, entity.metadata, entity.release_date).slice(1)
	]);
	const age = $derived(ageRating(entity.kind, entity.metadata));
	const average = $derived(data.rating?.count ? data.rating.average : null);
	const lead = $derived(leadCredits(entity.kind, entity.credits));
	const fields = $derived([
		...(entity.release_date
			? [{ label: 'Дата выхода', value: formatDate(entity.release_date) }]
			: []),
		...metadataFields(entity.kind, entity.metadata)
	]);
	const description = $derived(
		summary(entity.description) ||
			`${kind.one} «${entity.title}»${year ? ` (${year})` : ''}: оценки, рецензии и обсуждения в Nexus.`
	);
</script>

<Seo title="{entity.title}{year ? ` (${year})` : ''}" {description} image={entity.cover_url} />

{#key entity.id}
	<CardHero
		bind:this={hero}
		sources={trailers}
		title={entity.title}
		kind={entity.kind}
		coverUrl={entity.cover_url}
	>
		<nav aria-label="Раздел" class="text-sm font-semibold tracking-widest uppercase">
			<a href="/{kind.slug}" class="link text-primary link-hover">{kind.one}</a>
		</nav>
		<h1 class="mt-2 text-4xl leading-none font-black tracking-tight drop-shadow-lg sm:text-6xl">
			{entity.title}
		</h1>
		{#if entity.original_title && entity.original_title !== entity.title}
			<p class="mt-2 text-lg text-base-content/60">{entity.original_title}</p>
		{/if}

		{#if facts.length || age || average != null}
			<p class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium text-base-content/70">
				{#if average != null}<RatingBadge value={average} average />{/if}
				{#each facts as fact, i (i)}<span>{fact}</span>{/each}
				{#if age}<span class="badge badge-outline badge-sm font-semibold">{age}</span>{/if}
			</p>
		{/if}

		{#if entity.description}
			<p class="mt-3 line-clamp-4 text-lg leading-snug text-base-content/90">
				{entity.description}
			</p>
		{/if}

		{#if lead}
			<p class="mt-4 text-base-content/60">
				{lead.label}:
				{#each lead.people as person, i (person.slug)}{i ? ', ' : ''}<a
						href="/people/{person.slug}"
						class="link font-medium text-base-content decoration-base-content/30 underline-offset-4 hover:text-primary"
						>{person.full_name}</a
					>{/each}
			</p>
		{/if}

		<div class="mt-6 flex flex-wrap gap-3">
			{#if trailers.length}
				<TrailerButton
					sources={trailers}
					title={entity.title}
					coverUrl={entity.cover_url}
					onopen={() => hero?.pause()}
					onclose={() => hero?.resume()}
				/>
			{/if}
			<AddToCollection slug={entity.slug} title={entity.title} onchange={() => invalidateAll()} />
		</div>
	</CardHero>
{/key}

<section aria-labelledby="reviews-title" class="mb-12">
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
		<h2 id="reviews-title" class="text-2xl font-bold">Оценки и рецензии</h2>
		{#if data.reviews.data?.total}
			<a
				href={withQuery(`${page.url.pathname}/reviews`, { sort: sortParam(data.sort) })}
				class="link text-sm link-primary link-hover">Все рецензии ({data.reviews.data.total}) →</a
			>
		{/if}
	</div>
	<div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
		<div class="flex flex-col gap-4">
			{#if data.rating}<RatingSummary rating={data.rating} />{/if}
			<!-- Своё изменили — сводка и список перечитываются (load в браузере). -->
			<MyReview slug={entity.slug} onchange={() => invalidateAll()} />
		</div>
		<div class="min-w-0">
			{#if data.reviews.error}
				<LoadError message={data.reviews.error} />
			{:else if data.reviews.data?.items.length}
				{#if data.reviews.data.total > 1}
					<div class="mb-4 overflow-x-auto"><ReviewSortTabs current={data.sort} /></div>
				{/if}
				<ul class="flex flex-col gap-3" aria-label="Рецензии">
					{#each data.reviews.data.items as review (review.id)}
						<li><ReviewItem {review} /></li>
					{/each}
				</ul>
			{:else}
				<p
					class="rounded-box border border-dashed border-base-300 p-6 text-center text-base-content/60"
				>
					Рецензий пока нет{data.rating?.count
						? `, но уже ${count(data.rating.count, ['оценка', 'оценки', 'оценок'])}`
						: ''}. Напишите первую!
				</p>
			{/if}
		</div>
	</div>
</section>

<section aria-labelledby="threads-title" class="mb-12">
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
		<h2 id="threads-title" class="text-2xl font-bold">Обсуждения</h2>
		<div class="flex flex-wrap items-center gap-3">
			{#if data.threads.data?.total}
				<a href="{page.url.pathname}/threads" class="link text-sm link-primary link-hover"
					>Все обсуждения ({data.threads.data.total}) →</a
				>
			{/if}
			<NewThreadButton entity={entity.slug} label="Начать обсуждение" />
		</div>
	</div>
	{#if data.threads.error}
		<LoadError message={data.threads.error} />
	{:else if data.threads.data?.items.length}
		<ul class="grid gap-3 md:grid-cols-2" aria-label="Обсуждения">
			{#each data.threads.data.items as thread (thread.id)}
				<li class="min-w-0"><ThreadItem {thread} /></li>
			{/each}
		</ul>
	{:else}
		<p
			class="rounded-box border border-dashed border-base-300 p-6 text-center text-base-content/60"
		>
			Обсуждений пока нет. Тему можно привязать сразу к нескольким произведениям — например, к книге
			и её экранизациям.
		</p>
	{/if}
</section>

{#if data.collections.data?.items.length}
	<section aria-labelledby="collections-title" class="mb-12">
		<h2 id="collections-title" class="mb-4 text-2xl font-bold">
			В коллекциях
			<span class="ml-1 text-sm font-normal text-base-content/40"
				>{data.collections.data.total}</span
			>
		</h2>
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="В коллекциях">
			{#each data.collections.data.items as collection (collection.id)}
				<li><CollectionCard {collection} /></li>
			{/each}
		</ul>
	</section>
{/if}

<div class="grid gap-10 lg:grid-cols-[1fr_20rem]">
	<div class="min-w-0">
		{#if entity.credits.length}
			<section aria-labelledby="credits-title">
				<h2 id="credits-title" class="mb-4 text-xl font-bold">Участники</h2>
				<ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{#each entity.credits as credit (credit.id)}
						<li>
							<a
								href="/people/{credit.person.slug}"
								class="group flex items-center gap-3 rounded-box p-2 transition-colors hover:bg-base-200"
							>
								<PersonAvatar
									name={credit.person.full_name}
									photoUrl={credit.person.photo_url}
									size="sm"
								/>
								<span class="min-w-0">
									<span class="block truncate font-medium group-hover:text-primary"
										>{credit.person.full_name}</span
									>
									<span class="block truncate text-xs text-base-content/50">
										{[roleLabel(credit.role), credit.character_name].filter(Boolean).join(' · ')}
									</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<aside class="flex flex-col gap-6">
		{#if fields.length}
			<section aria-labelledby="about-title">
				<h2 id="about-title" class="mb-3 text-xl font-bold">
					О {kind.kind === 'book'
						? 'книге'
						: kind.kind === 'game'
							? 'игре'
							: kind.kind === 'series'
								? 'сериале'
								: 'фильме'}
				</h2>
				<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
					{#each fields as field (field.label)}
						<dt class="text-base-content/50">{field.label}</dt>
						<dd>{field.value}</dd>
					{/each}
				</dl>
			</section>
		{/if}
		{#if entity.tags.length}
			<section aria-labelledby="tags-title">
				<h2 id="tags-title" class="mb-3 text-xl font-bold">Теги</h2>
				<TagChips tags={entity.tags} />
			</section>
		{/if}
	</aside>
</div>
