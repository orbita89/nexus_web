<script lang="ts">
	import type { SchemaEntityAward } from '#lib/api/generated/catalog.ts';
	import { awardsTally, editionHref, groupAwards } from '#lib/catalog/awards.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { count } from '#lib/catalog/labels.ts';
	import AwardLogo from '#lib/components/catalog/AwardLogo.svelte';

	// Награды работы или человека: по премиям, внутри — по годам, победы выше номинаций.
	// Каждый год — ссылка на церемонию. Пустой список — блока нет (решает вызывающий).
	let {
		awards,
		title = 'Награды',
		/** В профиле человека у номинации есть работа — её показываем строкой. */
		withEntity = false
	}: { awards: SchemaEntityAward[]; title?: string; withEntity?: boolean } = $props();

	const groups = $derived(groupAwards(awards));
	const tally = $derived(awardsTally(awards));
</script>

<section id="awards" class="mb-14">
	<h2 class="mb-1 text-xl font-bold sm:text-2xl">{title}</h2>
	<p class="mb-5 text-sm text-base-content/50">
		{#if tally.wins}{count(tally.wins, ['награда', 'награды', 'наград'])}{/if}
		{#if tally.wins && tally.nominations}<span aria-hidden="true"> · </span>{/if}
		{#if tally.nominations}{count(tally.nominations, ['номинация', 'номинации', 'номинаций'])}{/if}
	</p>

	<ul class="flex flex-col gap-5">
		{#each groups as group (group.award.slug)}
			<li class="flex gap-3">
				<AwardLogo title={group.award.title} logoUrl={group.award.logo_url} size="size-10" />
				<div class="min-w-0 flex-1">
					<a href="/awards/{group.award.slug}" class="font-bold link-hover">{group.award.title}</a>
					<ul class="mt-1 flex flex-col gap-1">
						{#each group.years as year (year.year)}
							{#each year.items as item, i (i)}
								<li class="flex flex-wrap items-baseline gap-x-2 text-sm">
									<span aria-hidden="true" class={{ 'opacity-40 grayscale': !item.won }}>🏆</span>
									<a href={editionHref(group.award.slug, item.year)} class="font-medium link-hover"
										>{item.year}</a
									>
									<span class="text-base-content/70">{item.category.title}</span>
									{#if withEntity && item.entity}
										<a href={entityHref(item.entity)} class="text-xs text-primary/80 link-hover"
											>{item.entity.title}</a
										>
									{/if}
									{#if item.role}<span class="text-xs text-base-content/45">{item.role}</span>{/if}
									{#if !item.won}<span class="text-xs text-base-content/40">номинация</span>{/if}
								</li>
							{/each}
						{/each}
					</ul>
				</div>
			</li>
		{/each}
	</ul>
</section>
