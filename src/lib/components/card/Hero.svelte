<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		SchemaCrop,
		SchemaEntityDetail,
		SchemaPaintingMetadata
	} from '#lib/api/generated/catalog.ts';
	import type { Canvas } from '#lib/catalog/paintings.ts';
	import type { TrailerSource } from '#lib/catalog/trailer.ts';
	import CardHero from '#lib/components/catalog/CardHero.svelte';
	import ArtNav from '#lib/components/card/ArtNav.svelte';
	import ArtViewer from '#lib/components/catalog/ArtViewer.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// Первый экран карточки:
	// - есть трейлер — шапка как у Okko (CardHero): трейлер фоном, текст поверх, постера нет;
	// - нет трейлера — постер слева, тот же текст справа.
	// В шапке только русское название, кнопки и под ними личные отметки. Описание, факты (год,
	// длительность, возраст), режиссёр и роли — ниже, во вкладке «О фильме». Под названием — жанры
	// (теги kind = genre), остальные теги — над «О фильме».
	// Кнопки «Трейлер» пока нет: трейлер и так идёт фоном (у CardHero — свои звук и полный экран).
	let {
		entity,
		trailers,
		parent = null,
		canvas = null,
		openCrop = $bindable(null),
		marks,
		actions
	}: {
		entity: SchemaEntityDetail;
		trailers: TrailerSource[];
		/** Сериал над названием сезона: «Сезон 2» сам по себе ничего не говорит. */
		parent?: { title: string; href: string } | null;
		/** Холст картины: исходник для увеличения, если он есть, иначе обложка. */
		canvas?: Canvas | null;
		/** Фрагмент из ленты деталей: холст откроется увеличенным на этом месте. */
		openCrop?: SchemaCrop | null;
		/** Под кнопками: «Посмотреть позже», «Просмотрено». */
		marks: Snippet;
		/** Кнопки: оценка, «Оценить», «В коллекцию», «Следить». */
		actions: Snippet;
	} = $props();

	const genres = $derived(entity.tags.filter((t) => t.kind === 'genre'));

	/** Открыть холст целиком — тот же просмотр, что по щелчку, но кнопкой с подписью. */
	const WHOLE_CANVAS: SchemaCrop = { x: 0, y: 0, width: 1, height: 1 };

	// «363 × 437 см» — высота × ширина, как в музейной подписи; нет одного из размеров — нет строки.
	const size = $derived.by(() => {
		if (entity.kind !== 'painting') return null;
		const m = entity.metadata as SchemaPaintingMetadata;
		return m.height_cm && m.width_cm ? `${m.height_cm} × ${m.width_cm} см` : null;
	});
</script>

{#snippet content()}
	{#if parent}
		<a
			href={parent.href}
			class="mb-1 inline-block text-sm font-semibold text-base-content/60 drop-shadow-lg transition-colors hover:text-primary"
			>{parent.title}</a
		>
	{/if}
	<h1
		class="text-2xl leading-tight font-black tracking-tight text-balance drop-shadow-lg sm:text-4xl"
	>
		{entity.title}
	</h1>
	{#if genres.length}
		<ul class="mt-3 flex flex-wrap gap-x-2 text-sm text-base-content/70" aria-label="Жанры">
			{#each genres as genre, i (genre.slug)}
				<li>
					{#if i}<span class="mr-2 text-base-content/30" aria-hidden="true">·</span>{/if}<a
						href="/tags/{genre.slug}"
						class="hover:text-primary">{genre.name}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="mt-7 flex flex-wrap items-center gap-3">
		{@render actions()}
	</div>

	{@render marks()}
{/snippet}

{#if trailers.length}
	<CardHero sources={trailers} title={entity.title} kind={entity.kind} coverUrl={entity.cover_url}>
		{@render content()}
	</CardHero>
{:else if entity.kind === 'painting' && entity.cover_url}
	<!-- Картина — сама страница: холст во всю ширину и почти во всю высоту экрана, название и
	     кнопки под ним. Щелчок открывает её во весь экран с увеличением — в исходном разрешении,
	     если оно есть: по обложке выдачи второй шаг увеличения уже расплывается. -->
	<section aria-label="Шапка: {entity.title}" class="mb-12">
		<ArtViewer
			src={canvas?.src ?? entity.cover_url}
			title={entity.title}
			max={canvas?.width && canvas.width >= 2000 ? 16 : 6}
			bind:open={openCrop}
		>
			<img
				src={entity.cover_url}
				alt="Картина: {entity.title}"
				fetchpriority="high"
				class="mx-auto max-h-[72vh] w-auto max-w-full rounded-box shadow-2xl ring-1 ring-base-content/10"
			/>
		</ArtViewer>
		<!-- Панель под холстом: чем заняться с картиной и какого она размера. Всё, что здесь есть,
		     делает именно холст — поэтому панель у холста, а не в общем ряду кнопок с «Оценить». -->
		<div class="mt-4 flex flex-wrap items-center justify-center gap-2">
			<button
				type="button"
				class="btn rounded-full btn-sm"
				onclick={() => (openCrop = WHOLE_CANVAS)}
			>
				⛶ Во весь экран
			</button>
			{#if size}
				<!-- Размер холста — не украшение: «Ночной дозор» 363 × 437 см, и без этой строчки
				     он на экране такой же, как миниатюра. -->
				<span
					class="rounded-full bg-base-200 px-3 py-1.5 text-xs text-base-content/60 ring-1 ring-base-content/5"
					>Масштаб: {size}</span
				>
			{/if}
		</div>

		<!-- Листание холстов: следующая картина того ряда, из которого сюда пришли. -->
		<ArtNav slug={entity.slug} />
		<div class="mx-auto mt-8 max-w-3xl">{@render content()}</div>
	</section>
{:else}
	<section
		aria-label="Шапка: {entity.title}"
		class="mb-12 grid items-start gap-6 sm:grid-cols-[12rem_1fr] md:grid-cols-[16rem_1fr] md:gap-10"
	>
		<div class="w-40 sm:w-auto">
			<Poster
				title={entity.title}
				kind={entity.kind}
				coverUrl={entity.cover_url}
				alt="{entity.kind === 'painting' ? 'Картина' : 'Постер'}: {entity.title}"
				eager
			/>
		</div>
		<div class="max-w-2xl min-w-0 md:pt-4">{@render content()}</div>
	</section>
{/if}
