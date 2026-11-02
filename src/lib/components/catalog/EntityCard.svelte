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
		wall = false,
		rating
	}: {
		entity: SchemaEntitySummary;
		/** Средняя оценка (пакетно на страницу); нет оценок — без бейджа. */
		rating?: SchemaRatingBrief;
		/** Строка под названием: роль человека в работе. */
		caption?: string;
		/** Подписать раздел (в выдаче, где перемешаны фильмы и книги). */
		showKind?: boolean;
		/** Стена картин: холст во всю ширину карточки, высота — по его пропорциям. */
		wall?: boolean;
	} = $props();

	let failed = $state(false);
	/** Стена — только для картин с изображением; без него карточка обычная, с заглушкой. */
	const onWall = $derived(wall && entity.kind === 'painting' && !!entity.cover_url && !failed);

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
		{#if onWall}
			<img
				src={entity.cover_url}
				alt=""
				loading="lazy"
				decoding="async"
				class="w-full rounded-box ring-1 ring-base-content/10"
				onerror={() => (failed = true)}
			/>
		{:else}
			<Poster title={entity.title} kind={entity.kind} coverUrl={entity.cover_url} />
		{/if}
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
		<span
			class="absolute top-2 right-2 shadow-md transition duration-300 group-hover:-translate-y-1"
			><RatingBadge value={rating.average} average size="sm" /></span
		>
	{/if}
</a>
