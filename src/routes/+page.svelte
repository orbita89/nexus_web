<script lang="ts">
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagChips from '#lib/components/catalog/TagChips.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Пустой раздел на главной не показываем; ошибку — показываем один раз, а не в каждой полосе.
	const filled = $derived(data.sections.filter((s) => s.result.data?.items.length));
	const failed = $derived(data.sections.find((s) => s.result.error)?.result.error);
</script>

<Seo
	title="Фильмы, сериалы, книги и игры"
	description="Nexus — каталог фильмов, сериалов, книг и игр: оценки, рецензии, коллекции и обсуждения, привязанные к произведениям."
/>

<section
	class="relative mb-10 overflow-hidden rounded-box bg-linear-to-br from-primary/25 via-base-200 to-secondary/15 px-6 py-10 ring-1 ring-base-300 sm:px-10 sm:py-14"
>
	<p class="text-xs font-semibold tracking-[0.3em] text-primary uppercase">Nexus</p>
	<h1 class="mt-3 max-w-2xl text-3xl leading-tight font-black sm:text-5xl">
		Всё, что смотрят, читают и проходят
	</h1>
	<p class="mt-3 max-w-xl text-base-content/70">
		Фильмы, сериалы, книги и игры в одном каталоге — с оценками, рецензиями и обсуждениями, которые
		связывают книгу с её экранизацией.
	</p>
	<form action="/search" method="GET" role="search" class="mt-6 flex max-w-lg gap-2">
		<input
			type="search"
			name="q"
			placeholder="Дюна, Кинг, киберпанк…"
			aria-label="Найти в каталоге"
			class="input w-full bg-base-100/80 input-lg"
		/>
		<button class="btn btn-lg btn-primary">Найти</button>
	</form>
</section>

{#if failed}
	<div class="mb-8"><LoadError message={failed} /></div>
{/if}

{#each filled as section (section.slug)}
	<section class="mb-10" aria-labelledby="new-{section.slug}">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<h2 id="new-{section.slug}" class="text-xl font-bold">
				{section.title}
				<span class="ml-1 text-sm font-normal text-base-content/40">новинки</span>
			</h2>
			<a href="/{section.slug}" class="link text-sm link-primary link-hover">Все →</a>
		</div>
		<PosterStrip entities={section.result.data!.items} label="Новинки: {section.title}" />
	</section>
{/each}

{#if !failed && filled.length === 0}
	<EmptyState title="Каталог пока пуст"
		>Скоро здесь появятся фильмы, сериалы, книги и игры.</EmptyState
	>
{/if}

{#if data.tags.length}
	<section aria-labelledby="popular-tags" class="mb-6">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<h2 id="popular-tags" class="text-xl font-bold">Популярные теги</h2>
			<a href="/tags" class="link text-sm link-primary link-hover">Все теги →</a>
		</div>
		<TagChips tags={data.tags} label="Популярные теги" />
	</section>
{/if}
