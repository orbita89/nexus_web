<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { SchemaRatingBrief } from '#lib/api/generated/social.ts';
	import { entityHref, kindByApi } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import RatingBadge from '#lib/components/social/RatingBadge.svelte';
	import Poster from './Poster.svelte';

	let {
		entity,
		caption,
		showKind = false,
		rating
	}: {
		entity: SchemaEntitySummary;
		/** Средняя оценка (пакетно на страницу); нет оценок — без бейджа. */
		rating?: SchemaRatingBrief;
		/** Строка под названием: роль человека в работе. */
		caption?: string;
		/** Подписать раздел (в выдаче, где перемешаны фильмы и книги). */
		showKind?: boolean;
	} = $props();

	const meta = $derived(
		[yearOf(entity.release_date), showKind ? kindByApi(entity.kind).one : null]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<a href={entityHref(entity)} class="group relative block rounded-box outline-offset-4">
	<div
		class="rounded-box transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-2 group-hover:shadow-primary/20 group-hover:ring-primary group-focus-visible:ring-2 group-focus-visible:ring-primary"
	>
		<Poster title={entity.title} kind={entity.kind} coverUrl={entity.cover_url} />
	</div>
	<div class="mt-2 px-0.5">
		<h3
			class="line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-primary"
		>
			{entity.title}
		</h3>
		{#if meta}<p class="mt-0.5 text-xs text-base-content/50">{meta}</p>{/if}
		{#if caption}<p class="mt-0.5 line-clamp-2 text-xs text-primary/80">{caption}</p>{/if}
	</div>
	<!-- Бейдж — в углу постера, но в разметке после названия: имя ссылки начинается с названия. -->
	{#if rating?.count && rating.average != null}
		<span class="absolute top-2 left-2 shadow-md transition duration-300 group-hover:-translate-y-1"
			><RatingBadge value={rating.average} average size="sm" /></span
		>
	{/if}
</a>
