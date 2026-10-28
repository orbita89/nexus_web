<script lang="ts">
	import {
		awardCatalogHref,
		editionHref,
		numberLabel,
		seasonLabel,
		yearsLabel
	} from '#lib/catalog/awards.ts';
	import { kindByApi } from '#lib/catalog/kinds.ts';
	import { count } from '#lib/catalog/labels.ts';
	import AwardLogo from '#lib/components/catalog/AwardLogo.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	// Премия: описание и сетка церемоний, новые сверху. Описание, логотип, сайт и страна часто
	// пустые — блок с ними рисуем только когда есть что показать.
	let { data }: PageProps = $props();

	const award = $derived(data.award);
	// В AwardDetail нет first_year/latest_year — берём края из списка церемоний (он по убыванию).
	const years = $derived(
		yearsLabel({
			first_year: award.editions.at(-1)?.year ?? null,
			latest_year: award.editions[0]?.year ?? null
		})
	);
	const kinds = $derived(
		award.kinds.map((k) => kindByApi(k as Parameters<typeof kindByApi>[0]).title)
	);
	const facts = $derived([award.country, years, ...kinds].filter(Boolean) as string[]);
</script>

<Seo
	title={award.title}
	description={award.description ??
		`${award.full_title ?? award.title}: церемонии по годам, победители и номинанты.`}
	image={award.logo_url}
/>

<nav class="mb-4 text-sm text-base-content/50" aria-label="Хлебные крошки">
	<a href="/awards" class="link-hover">Награды</a>
</nav>

<header class="mb-8 flex flex-wrap items-start gap-4">
	<AwardLogo title={award.title} logoUrl={award.logo_url} size="size-20" />
	<div class="min-w-0 flex-1">
		<h1 class="text-3xl font-black sm:text-4xl">{award.title}</h1>
		{#if award.full_title}
			<p class="mt-1 text-sm text-base-content/60">{award.full_title}</p>
		{/if}
		{#if facts.length}
			<p class="mt-2 text-sm text-base-content/50">{facts.join(' · ')}</p>
		{/if}
		<a
			href={awardCatalogHref(award.kinds, award.slug)}
			class="mt-2 mr-3 inline-block link text-sm link-primary">Работы премии в каталоге</a
		>
		{#if award.site_url}
			<a
				href={award.site_url}
				target="_blank"
				rel="noreferrer nofollow"
				class="mt-2 inline-block link text-sm link-primary">Официальный сайт</a
			>
		{/if}
	</div>
</header>

{#if award.description}
	<p class="mb-10 max-w-3xl whitespace-pre-wrap text-base-content/80">{award.description}</p>
{/if}

<h2 class="mb-4 text-xl font-bold">
	Церемонии
	{#if award.editions.length}
		<span class="ml-1 text-sm font-normal text-base-content/50"
			>{count(award.editions.length, ['год', 'года', 'лет'])}</span
		>
	{/if}
</h2>

{#if award.editions.length}
	<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each award.editions as edition (edition.year)}
			{@const season = seasonLabel(edition)}
			{@const number = numberLabel(edition.number)}
			<li>
				<a
					href={editionHref(award.slug, edition.year)}
					class="group flex h-full flex-col gap-3 rounded-box border border-base-300 p-4 transition-colors hover:border-primary hover:bg-base-200"
				>
					<span class="flex items-baseline gap-2">
						<span class="text-2xl font-black group-hover:text-primary">{edition.year}</span>
						{#if number}<span class="text-xs text-base-content/50">{number}</span>{/if}
					</span>
					{#if season}<span class="-mt-2 text-xs text-base-content/50">{season}</span>{/if}
					{#if edition.top.length}
						<!-- Победители главной категории: по ним год узнают быстрее, чем по номеру. -->
						<span class="flex gap-2">
							{#each edition.top.slice(0, 4) as entity (entity.id)}
								<span class="w-12 shrink-0">
									<Poster
										title={entity.title}
										kind={entity.kind}
										coverUrl={entity.cover_url}
										small
									/>
								</span>
							{/each}
						</span>
					{/if}
					<span class="mt-auto text-xs text-base-content/50">
						{count(edition.nominations_count, ['номинация', 'номинации', 'номинаций'])}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<EmptyState title="Церемоний пока нет">
		Премия заведена, но ни одной церемонии ещё не залито.
	</EmptyState>
{/if}
