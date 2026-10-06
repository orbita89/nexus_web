<script lang="ts">
	import { kindByApi } from '#lib/catalog/kinds.ts';
	import { formatDate, metadataFields, roleLabel, summary, yearOf } from '#lib/catalog/labels.ts';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagChips from '#lib/components/catalog/TagChips.svelte';
	import TrailerButton from '#lib/components/catalog/TrailerButton.svelte';
	import { trailerSources } from '#lib/catalog/trailer.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const entity = $derived(data.entity);
	const kind = $derived(kindByApi(entity.kind));
	const year = $derived(yearOf(entity.release_date));
	const fields = $derived([
		...(entity.release_date
			? [{ label: 'Дата выхода', value: formatDate(entity.release_date) }]
			: []),
		...metadataFields(entity.kind, entity.metadata)
	]);
	const trailers = $derived(trailerSources(entity));
	const description = $derived(
		summary(entity.description) ||
			`${kind.one} «${entity.title}»${year ? ` (${year})` : ''}: оценки, рецензии и обсуждения в Nexus.`
	);
</script>

<Seo title="{entity.title}{year ? ` (${year})` : ''}" {description} image={entity.cover_url} />

<!-- Фон под шапкой карточки, как у Okko: размытый постер, уходящий в чёрный; без постера —
     отсвет цвета раздела. -->
<div
	class="pointer-events-none absolute inset-x-0 top-16 -z-10 h-[34rem] overflow-hidden"
	aria-hidden="true"
>
	{#if entity.cover_url}
		<img
			src={entity.cover_url}
			alt=""
			class="h-full w-full scale-125 object-cover opacity-45 blur-3xl"
		/>
		<div class="absolute inset-0 bg-linear-to-b from-base-100/20 via-base-100/70 to-base-100"></div>
	{:else}
		<div
			class={[
				'h-full bg-linear-to-b to-transparent',
				{
					'from-primary/15': entity.kind === 'movie',
					'from-secondary/15': entity.kind === 'series',
					'from-accent/10': entity.kind === 'book',
					'from-info/10': entity.kind === 'game'
				}
			]}
		></div>
	{/if}
</div>

<article class="relative grid gap-8 md:grid-cols-[minmax(0,15rem)_1fr] lg:gap-12">
	<div class="mx-auto w-48 sm:w-56 md:w-full">
		<Poster
			title={entity.title}
			kind={entity.kind}
			coverUrl={entity.cover_url}
			alt="Обложка: {entity.title}"
			eager
		/>
	</div>

	<div class="min-w-0">
		<nav aria-label="Раздел" class="text-sm">
			<a href="/{kind.slug}" class="link text-primary link-hover">{kind.title}</a>
			{#if year}<span class="text-base-content/40"> · {year}</span>{/if}
		</nav>
		<h1 class="mt-1 text-3xl leading-tight font-black sm:text-5xl">{entity.title}</h1>
		{#if entity.original_title && entity.original_title !== entity.title}
			<p class="mt-1 text-lg text-base-content/50">{entity.original_title}</p>
		{/if}

		{#if trailers.length}
			<div class="mt-5">
				<TrailerButton
					sources={trailers}
					title={entity.title}
					kind={entity.kind}
					coverUrl={entity.cover_url}
				/>
			</div>
		{/if}

		{#if entity.tags.length}
			<div class="mt-5"><TagChips tags={entity.tags} /></div>
		{/if}

		<div class="mt-6">
			<div class="min-w-0">
				{#if entity.description}
					<p class="leading-relaxed whitespace-pre-line text-base-content/80">
						{entity.description}
					</p>
				{/if}

				{#if fields.length}
					<dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
						{#each fields as field (field.label)}
							<dt class="text-base-content/50">{field.label}</dt>
							<dd>{field.value}</dd>
						{/each}
					</dl>
				{/if}
			</div>
		</div>

		{#if entity.credits.length}
			<section class="mt-10" aria-labelledby="credits-title">
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
</article>
