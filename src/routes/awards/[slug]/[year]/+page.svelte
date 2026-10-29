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
	import RatingBadge from '#lib/components/social/RatingBadge.svelte';
	import type { PageProps } from './$types';

	// Церемония: категории по порядку, в каждой победители крупно слева, номинанты — колонкой
	// справа. У многих церемоний категория одна («Общая категория») и нет ни номера, ни даты.
	let { data }: PageProps = $props();

	const edition = $derived(data.edition);
	const meta = $derived(editionMeta(edition));
	const title = $derived(`${edition.award.title} ${edition.year}`);

	const winners = (nominations: SchemaNomination[]) => nominations.filter((n) => n.won);
	const rest = (nominations: SchemaNomination[]) => nominations.filter((n) => !n.won);
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
		{@const top = winners(category.nominations)}
		{@const others = rest(category.nominations)}
		<section class="rounded-box border border-base-300 p-4 sm:p-5">
			<h2 class="mb-4 text-lg font-bold sm:text-xl">
				{categoryTitle(category, category.nominations[0])}
			</h2>

			<!-- Победители слева, номинанты колонкой справа; на телефоне — друг под другом. -->
			<div class="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
				{#if top.length}
					<ul class="flex flex-wrap justify-center gap-5 md:justify-start">
						{#each top as nomination (nomination.id)}
							{@const href = nomineeHref(nomination)}
							{@const note = nomineeNote(nomination)}
							<li class="w-32 sm:w-36">
								<span class="relative block">
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
											{#if note}
												<span class="block text-xs text-base-content/50">{note}</span>
											{/if}
										</svelte:element>
									{/if}
									<span
										class="absolute -top-2 -left-2 z-10 badge badge-sm badge-primary"
										title="Победитель">🏆</span
									>
								</span>
								{#if nomination.entity && !nomination.person && note}
									<span class="mt-1 block text-xs text-base-content/50">{note}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				{#if others.length}
					<ul class="flex flex-col gap-1 self-center">
						{#if top.length}
							<li class="mb-1 text-xs tracking-wide text-base-content/40 uppercase">Номинанты</li>
						{/if}
						{#each others as nomination (nomination.id)}
							{@const href = nomineeHref(nomination)}
							{@const note = nomineeNote(nomination)}
							{@const score = rating(nomination)}
							<li>
								<svelte:element
									this={href ? 'a' : 'div'}
									{href}
									class={[
										'flex items-center gap-2 rounded px-2 py-1 text-sm',
										href ? 'hover:bg-base-200' : 'cursor-default'
									]}
								>
									<span class="font-medium">{nomineeName(nomination)}</span>
									{#if note}<span class="text-xs text-base-content/50">{note}</span>{/if}
									{#if score?.count && score.average != null}
										<span class="ml-auto"
											><RatingBadge value={score.average} average size="sm" /></span
										>
									{/if}
								</svelte:element>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/each}
</div>
