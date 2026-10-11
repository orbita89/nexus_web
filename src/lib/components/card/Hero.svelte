<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import type { TrailerSource } from '#lib/catalog/trailer.ts';
	import CardHero from '#lib/components/catalog/CardHero.svelte';
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
		marks,
		actions
	}: {
		entity: SchemaEntityDetail;
		trailers: TrailerSource[];
		/** Под кнопками: «Посмотреть позже», «Просмотрено». */
		marks: Snippet;
		/** Кнопки: оценка, «Оценить», «В коллекцию», «Следить». */
		actions: Snippet;
	} = $props();

	const genres = $derived(entity.tags.filter((t) => t.kind === 'genre'));
</script>

{#snippet content()}
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
				alt="Постер: {entity.title}"
				eager
			/>
		</div>
		<div class="max-w-2xl min-w-0 md:pt-4">{@render content()}</div>
	</section>
{/if}
