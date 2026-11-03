<script module lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';

	/**
	 * Что карточке нужно от сущности. Шире `EntitySummary`: в отметках и лентах social приходит
	 * `EntityRef` — те же поля, но без размеров обложки (стена картин тогда держит место сама).
	 */
	export type CardEntity = Pick<
		SchemaEntitySummary,
		'id' | 'slug' | 'kind' | 'title' | 'cover_url' | 'release_date'
	> & { cover_width?: number | null; cover_height?: number | null };
</script>

<script lang="ts">
	import type { SchemaRatingBrief } from '#lib/api/generated/social.ts';
	import { entityHref, kindByApi } from '#lib/catalog/kinds.ts';
	import { rememberRow, type Row } from '#lib/catalog/row.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import RatingBadge from '#lib/components/social/RatingBadge.svelte';
	import Poster from './Poster.svelte';

	let {
		entity,
		caption,
		showKind = false,
		wall = false,
		row,
		rating
	}: {
		entity: CardEntity;
		/** Средняя оценка (пакетно на страницу); нет оценок — без бейджа. */
		rating?: SchemaRatingBrief;
		/** Строка под названием: роль человека в работе. */
		caption?: string;
		/** Подписать раздел (в выдаче, где перемешаны фильмы и книги). */
		showKind?: boolean;
		/** Стена картин: холст во всю ширину карточки, высота — по его пропорциям. */
		wall?: boolean;
		/** Список, из которого открыли карточку: по нему там листают соседние работы. */
		row?: Row;
	} = $props();

	let failed = $state(false);
	/** Холст загрузился — до этого держим под него место, иначе в стене висят голые подписи. */
	let loaded = $state(false);
	/** Пропорции обложки из API; нет размеров — null, и место держит заглушка. */
	const ratio = $derived(
		entity.cover_width && entity.cover_height
			? `${entity.cover_width} / ${entity.cover_height}`
			: null
	);
	/** Стена — только для картин с изображением; без него карточка обычная, с заглушкой. */
	const onWall = $derived(wall && entity.kind === 'painting' && !!entity.cover_url && !failed);

	const meta = $derived(
		[yearOf(entity.release_date), showKind ? kindByApi(entity.kind).one : null]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<!-- Ряд запоминаем на клике, а не на отрисовке: на странице человека списков несколько, и важно,
     из какого именно ушли. Адрес ссылки при этом не меняется — он остаётся чистым. -->
<a
	href={entityHref(entity)}
	onclick={() => row && rememberRow(row)}
	class="group relative block rounded-box outline-offset-4"
>
	<div
		class="relative rounded-box transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-2 group-hover:shadow-primary/20 group-hover:ring-primary group-focus-visible:ring-2 group-focus-visible:ring-primary"
	>
		{#if onWall}
			<!-- Пропорции холста знает API (cover_width/cover_height) — место под него держится точно,
			     и стена складывается с первого прохода. Размеров нет (старый импорт) — прежние 4:5. -->
			<img
				src={entity.cover_url}
				alt=""
				loading="lazy"
				decoding="async"
				style={ratio ? `aspect-ratio: ${ratio}` : undefined}
				class={[
					'w-full rounded-box object-cover ring-1 ring-base-content/10',
					!ratio && !loaded && 'aspect-4/5',
					!loaded && 'bg-base-300'
				]}
				onload={() => (loaded = true)}
				onerror={() => (failed = true)}
			/>
			<!-- Подпись поверх холста: появляется на наведении, на сенсорных экранах видна всегда. -->
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-box bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-8 pb-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
			>
				<h3 class="line-clamp-2 text-sm leading-snug font-semibold text-white">{entity.title}</h3>
				{#if meta}<p class="mt-0.5 text-xs text-white/70">{meta}</p>{/if}
			</div>
		{:else}
			<Poster title={entity.title} kind={entity.kind} coverUrl={entity.cover_url} />
		{/if}
	</div>
	{#if !onWall}
		<!-- Подпись держит высоту двух строк названия всегда: иначе в полосе ряд прыгает, и год
		     одной карточки оказывается на уровне названия соседней. -->
		<div class="mt-2 px-0.5">
			<h3
				class="line-clamp-2 min-h-[2.25rem] text-sm leading-snug font-semibold transition-colors group-hover:text-primary"
			>
				{entity.title}
			</h3>
			{#if meta}<p class="text-xs text-base-content/50">{meta}</p>{/if}
			{#if caption}<p class="mt-0.5 line-clamp-2 text-xs text-primary/80">{caption}</p>{/if}
		</div>
	{/if}
	<!-- Бейдж — в углу постера, но в разметке после названия: имя ссылки начинается с названия. -->
	{#if rating?.count && rating.average != null}
		<span
			class="absolute top-2 right-2 shadow-md transition duration-300 group-hover:-translate-y-1"
			><RatingBadge value={rating.average} average size="sm" /></span
		>
	{/if}
</a>
