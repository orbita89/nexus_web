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
	description="Кассандра — каталог фильмов, сериалов, книг и игр: оценки, рецензии, коллекции и обсуждения, привязанные к произведениям."
/>

<!-- Первый экран во всю ширину окна: выходит из колонки main (100cqw — ширина страницы
     без панели чата) и подтягивается под шапку. -->
<section
	class="relative mx-[calc(50%-50cqw)] -mt-6 mb-10 flex min-h-[30rem] w-[100cqw] flex-col justify-center overflow-hidden bg-base-100 py-16 sm:min-h-[42rem]"
>
	<!-- «Кассандра» Эвелин де Морган в неоновой инверсии. Нижний слой — сильно размытое небо и
	     горящая Троя во весь фон, верхний — сама фигура в полный рост. Оба гаснут маской в
	     чистый чёрный фон сайта. -->
	<img
		src="/cassandra.webp"
		alt=""
		aria-hidden="true"
		class="hero-sky pointer-events-none absolute inset-0 size-full object-cover object-top"
	/>
	<img
		src="/cassandra.webp"
		alt=""
		aria-hidden="true"
		fetchpriority="high"
		class="hero-figure pointer-events-none absolute top-0 left-1/2 h-[112%] w-auto max-w-none -translate-x-1/2 sm:left-[54%]"
	/>
	<!-- Лёгкая подложка под текстом слева — арт по краям остаётся виден. -->
	<div
		class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(9,9,11,0.72)_0%,rgba(9,9,11,0.42)_28%,transparent_55%)]"
	></div>

	<div class="relative mx-auto w-full max-w-6xl px-4">
		<h1 class="max-w-xl text-4xl leading-tight font-black sm:text-6xl">
			Всё, что смотрят, читают и проходят
		</h1>
		<p class="mt-5 max-w-md text-base-content/70">
			Фильмы, сериалы, книги и игры в одном каталоге — с оценками, рецензиями и обсуждениями,
			которые связывают книгу с её экранизацией.
		</p>
		<form action="/search" method="GET" role="search" class="mt-8 flex max-w-lg gap-2">
			<input
				type="search"
				name="q"
				placeholder="Дюна, Кинг, киберпанк…"
				aria-label="Найти в каталоге"
				class="input w-full bg-base-100/60 backdrop-blur input-lg"
			/>
			<button class="btn btn-lg btn-primary">Найти</button>
		</form>
	</div>
</section>

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

<style>
	/* Общее угасание арта в фон сайта к низу первого экрана. */
	.hero-sky,
	.hero-figure {
		-webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 98%);
		mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 98%);
	}
	.hero-sky {
		filter: blur(10px) brightness(0.6) saturate(1.2);
		transform: scale(1.15); /* размытие не должно оголять края */
	}
	/* Фигуре нужно ещё и боковое угасание — иначе виден вертикальный край холста. */
	.hero-figure {
		filter: blur(0.5px) brightness(0.8) saturate(1.15);
		-webkit-mask-image:
			linear-gradient(to bottom, #000 0%, #000 62%, transparent 98%),
			linear-gradient(to right, transparent 0%, #000 26%, #000 74%, transparent 100%);
		mask-image:
			linear-gradient(to bottom, #000 0%, #000 62%, transparent 98%),
			linear-gradient(to right, transparent 0%, #000 26%, #000 74%, transparent 100%);
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
	}
</style>
