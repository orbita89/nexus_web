<script lang="ts">
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
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
	class="relative mb-10 flex min-h-[24rem] flex-col justify-center overflow-hidden rounded-box bg-base-100 px-6 py-10 ring-1 ring-base-300 sm:min-h-[32rem] sm:px-10 sm:py-14"
>
	<!-- «Кассандра» Эвелин де Морган в неоновой инверсии. Арт живёт в верхней части экрана и
	     маской бесшовно гаснет в фон сайта чуть ниже строки поиска. -->
	<img
		src="/cassandra.webp"
		alt=""
		aria-hidden="true"
		fetchpriority="high"
		class="hero-art pointer-events-none absolute top-0 right-0 h-[112%] w-auto max-w-none sm:right-[6%]"
	/>
	<!-- Мягкие фиолетово-синие отсветы на тёмном фоне + затемнение слева под текст. -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_75%_20%,rgba(139,92,246,0.25),transparent_70%),radial-gradient(50%_45%_at_15%_85%,rgba(79,70,229,0.18),transparent_70%),linear-gradient(to_right,rgba(9,9,11,0.92)_0%,rgba(9,9,11,0.75)_38%,transparent_70%)]"
	></div>

	<div class="relative">
		<p class="text-xs font-semibold tracking-[0.3em] text-primary uppercase">Nexus</p>
		<h1 class="mt-3 max-w-2xl text-3xl leading-tight font-black sm:text-5xl">
			Всё, что смотрят, читают и проходят
		</h1>
		<p class="mt-3 max-w-xl text-base-content/70">
			Фильмы, сериалы, книги и игры в одном каталоге — с оценками, рецензиями и обсуждениями,
			которые связывают книгу с её экранизацией.
		</p>
		<form action="/search" method="GET" role="search" class="mt-6 flex max-w-lg gap-2">
			<input
				type="search"
				name="q"
				placeholder="Дюна, Кинг, киберпанк…"
				aria-label="Найти в каталоге"
				class="input w-full bg-base-100/70 backdrop-blur input-lg"
			/>
			<button class="btn btn-lg btn-primary">Найти</button>
		</form>
	</div>
</section>

<style>
	/* Размытие и затемнение арта + его угасание к низу блока. */
	.hero-art {
		filter: blur(3px) brightness(0.5) saturate(1.2);
		-webkit-mask-image:
			linear-gradient(to bottom, #000 0%, #000 45%, transparent 97%),
			linear-gradient(to right, transparent 0%, #000 28%, #000 74%, transparent 100%);
		mask-image:
			linear-gradient(to bottom, #000 0%, #000 45%, transparent 97%),
			linear-gradient(to right, transparent 0%, #000 28%, #000 74%, transparent 100%);
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
	}
</style>

{#if data.featured.length}
	<section class="mb-10" aria-labelledby="featured-collections">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<h2 id="featured-collections" class="text-xl font-bold">Подборки</h2>
			<a href="/collections/featured" class="link text-sm link-primary link-hover">Все →</a>
		</div>
		<ul class="grid gap-4 sm:grid-cols-2" aria-label="Подборки">
			{#each data.featured as collection (collection.id)}
				<li><FeaturedCollectionCard {collection} /></li>
			{/each}
		</ul>
	</section>
{/if}

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
		<PosterStrip
			entities={section.result.data!.items}
			label="Новинки: {section.title}"
			ratings={data.ratings}
		/>
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
