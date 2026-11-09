<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SchemaEntityDetail, SchemaPaintingMetadata } from '#lib/api/generated/catalog.ts';
	import { sizeOf } from '#lib/catalog/labels.ts';
	import type { Canvas, ViewerFocus } from '#lib/catalog/paintings.ts';
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
		openCrop?: ViewerFocus | null;
		/** Под кнопками: «Посмотреть позже», «Просмотрено». */
		marks: Snippet;
		/** Кнопки: оценка, «Оценить», «В коллекцию», «Следить». */
		actions: Snippet;
	} = $props();

	const genres = $derived(entity.tags.filter((t) => t.kind === 'genre'));

	/** Открыть холст целиком — тот же просмотр, что по щелчку, но кнопкой с подписью. */
	const WHOLE_CANVAS: ViewerFocus = { crop: { x: 0, y: 0, width: 1, height: 1 } };

	// «363 × 437 см» — тем же форматом, что в таблице фактов: один факт — один форматтер.
	const size = $derived(
		entity.kind === 'painting' ? sizeOf(entity.metadata as SchemaPaintingMetadata) : null
	);

	// Тень под текстом нужна только поверх трейлера: там за буквами движется картинка. На ровном
	// фоне она читается как грязь вокруг заголовка.
	const overVideo = $derived(trailers.length > 0);
</script>

{#snippet content()}
	{#if parent}
		<a
			href={parent.href}
			class={[
				'mb-1 inline-block text-sm font-semibold text-base-content/60 transition-colors hover:text-primary',
				overVideo && 'drop-shadow-lg'
			]}>{parent.title}</a
		>
	{/if}
	<h1
		class={[
			'text-2xl leading-tight font-black tracking-tight text-balance sm:text-4xl',
			overVideo && 'drop-shadow-lg'
		]}
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
		<!-- Листание холстов: следующая картина того ряда, из которого сюда пришли. Холст лежит
		     внутри ArtNav, между стрелками, — они стоят в полях и не закрывают живопись. -->
		<ArtNav slug={entity.slug}>
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
					class="mx-auto max-h-[72vh] w-auto max-w-full rounded-box shadow-xl ring-1 ring-base-content/5"
				/>
			</ArtViewer>
		</ArtNav>

		<!-- Панель под холстом — одна стеклянная капсула, а не ряд разнокалиберных кнопок: это
		     подпись у рамы, она не должна спорить с картиной. -->
		<div
			class="mx-auto mt-4 flex w-fit items-center gap-1 rounded-full bg-base-200/70 p-1 ring-1 ring-base-content/10 backdrop-blur-md"
		>
			<button
				type="button"
				class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:bg-base-100 hover:text-primary"
				onclick={() => (openCrop = WHOLE_CANVAS)}
			>
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"
					/>
				</svg>
				Во весь экран
			</button>
			{#if size}
				<!-- Размер холста — не украшение: «Ночной дозор» 363 × 437 см, и без этой строчки
				     он на экране такой же, как миниатюра. -->
				<span class="px-3 text-xs text-base-content/50 tabular-nums">{size}</span>
			{/if}
		</div>

		<div class="mx-auto mt-6 max-w-2xl">{@render content()}</div>
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
