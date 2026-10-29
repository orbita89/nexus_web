<script lang="ts">
	import type { SchemaNomination } from '#lib/api/generated/catalog.ts';
	import {
		awardCatalogHref,
		categoryTitle,
		editionMeta,
		nomineeHref,
		nomineeName,
		nomineeNote
	} from '#lib/catalog/awards.ts';
	import AwardLogo from '#lib/components/catalog/AwardLogo.svelte';
	import EntityCard from '#lib/components/catalog/EntityCard.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	// Церемония: категории по порядку, в каждой победители крупно слева, номинанты — колонкой
	// справа. У многих церемоний категория одна («Общая категория») и нет ни номера, ни даты.
	let { data }: PageProps = $props();

	const edition = $derived(data.edition);
	const meta = $derived(editionMeta(edition));
	const title = $derived(`${edition.award.title} ${edition.year}`);

	const rating = (nomination: SchemaNomination) =>
		nomination.entity ? data.ratings[nomination.entity.slug] : undefined;
</script>

<Seo
	{title}
	description="Победители и номинанты: {title}."
	image={edition.cover_url ?? edition.award.logo_url}
/>

<nav class="mb-4 text-sm text-base-content/50" aria-label="Хлебные крошки">
	<a href="/awards" class="link-hover">Награды</a>
	<span aria-hidden="true"> / </span>
	<a href="/awards/{edition.award.slug}" class="link-hover">{edition.award.title}</a>
</nav>

<header class="mb-10 flex flex-wrap items-start gap-4">
	<AwardLogo title={edition.award.title} logoUrl={edition.award.logo_url} size="size-16" />
	<div class="min-w-0 flex-1">
		<h1 class="text-3xl font-black sm:text-4xl">{title}</h1>
		{#if meta.length}<p class="mt-2 text-sm text-base-content/50">{meta.join(' · ')}</p>{/if}
		<a
			href={awardCatalogHref(edition.award.kinds, edition.award.slug, edition.year)}
			class="mt-2 inline-block link text-sm link-primary">Работы этого года в каталоге</a
		>
	</div>
</header>

<div class="flex flex-col gap-10">
	{#each edition.categories as category (category.slug)}
		<section class="rounded-box border border-base-300 p-4 sm:p-5">
			<h2 class="mb-5 text-center text-lg font-bold sm:text-xl">
				{categoryTitle(category, category.nominations[0])}
			</h2>

			<!-- Победители и номинанты — одной сеткой карточек: постер есть и у тех, и у других,
			     победителя отличает трофей. Ряд по центру: в категории часто одна-две работы. -->
			<ul class="flex flex-wrap justify-center gap-5">
				{#each category.nominations as nomination (nomination.id)}
					{@const href = nomineeHref(nomination)}
					{@const note = nomineeNote(nomination)}
					<li class="w-32 sm:w-36">
						<div class="relative">
							{#if nomination.entity && !nomination.person}
								<EntityCard entity={nomination.entity} rating={rating(nomination)} />
							{:else}
								<svelte:element
									this={href ? 'a' : 'div'}
									{href}
									class={['group block text-center', { 'cursor-default': !href }]}
								>
									{#if nomination.person}
										<span class="flex justify-center">
											<PersonAvatar
												name={nomination.person.full_name}
												photoUrl={nomination.person.photo_url}
												size="lg"
											/>
										</span>
									{:else}
										<span
											class="flex aspect-2/3 w-full items-center justify-center rounded-box bg-base-300 p-2 text-center text-xs text-base-content/50"
											>{nomineeName(nomination)}</span
										>
									{/if}
									<span class="mt-2 block text-sm font-bold group-hover:text-primary"
										>{nomineeName(nomination)}</span
									>
								</svelte:element>
							{/if}
							{#if nomination.won}
								<span
									class="absolute -top-2 -left-2 z-10 badge badge-sm badge-primary"
									title="Победитель">🏆</span
								>
							{/if}
						</div>
						{#if note}<span class="mt-1 block text-xs text-base-content/50">{note}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
