<script lang="ts">
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagChips from '#lib/components/catalog/TagChips.svelte';
	import { KINDS } from '#lib/catalog/kinds.ts';
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
	class="relative mx-[calc(50%-50cqw)] -mt-[5.5rem] mb-10 flex min-h-[32rem] w-[100cqw] flex-col justify-center pt-[9rem] pb-14 sm:min-h-[84vh]"
>
	<!-- «Кассандра» Эвелин де Морган в авторской неоновой гамме — она даёт глубину, которой
	     нет у плоской перекраски. Чуть приглушена по насыщенности, чтобы не спорить с
	     оранжевым акцентом. Слой выше самого блока — картина продолжается за «Подборками»
	     и только там гаснет в фон сайта.
	     Файл обрезан по верхние 62% холста — видна всё равно только эта часть, зато пикселей
	     хватает на широкий экран без апскейла, и размытие больше не нужно.
	     AVIF с webp-запаской: то же разрешение почти без потерь и вдвое легче. -->
	<div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[170%] overflow-hidden">
		<picture class="block size-full">
			<source
				type="image/avif"
				srcset="/cassandra-820.avif 820w, /cassandra.avif 1536w"
				sizes="100vw"
			/>
			<source
				type="image/webp"
				srcset="/cassandra-820.webp 820w, /cassandra.webp 1536w"
				sizes="100vw"
			/>
			<img
				src="/cassandra.webp"
				alt=""
				aria-hidden="true"
				fetchpriority="high"
				class="size-full scale-105 object-cover object-[46%_0%] brightness-[0.92] saturate-[0.72] sm:origin-right sm:translate-x-[4%] sm:scale-[1.04] sm:object-[50%_62%]"
			/>
		</picture>
		<!-- Затемнение вниз: к «Подборкам» от картины остаётся лишь тёмный отсвет. -->
		<div
			class="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(9,9,11,0.15)_0%,rgba(9,9,11,0.4)_42%,rgba(9,9,11,0.85)_62%,rgba(9,9,11,0.97)_82%,#09090b_100%)]"
		></div>
		<!-- Подложка под текстом слева — арт по краям остаётся виден. -->
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,rgba(9,9,11,0.88)_0%,rgba(9,9,11,0.6)_28%,transparent_55%)]"
		></div>
	</div>

	<div class="relative mx-auto w-full max-w-6xl px-4">
		<h1 class="max-w-xl text-4xl leading-tight font-black tracking-[-0.02em] sm:text-6xl">
			Всё, что смотрят, читают и проходят
		</h1>
		<!-- Стеклянная плашка: подзаголовок и поиск не лежат голым текстом на картине. -->
		<div
			class="mt-6 max-w-xl rounded-box bg-base-100/35 p-5 ring-1 ring-base-content/10 backdrop-blur-md"
		>
			<p class="text-base-content/80">
				Фильмы, сериалы, книги и игры в одном каталоге — с оценками, рецензиями и обсуждениями,
				которые связывают книгу с её экранизацией.
			</p>
			<form action="/search" method="GET" role="search" class="mt-4 flex gap-2">
				<input
					type="search"
					name="q"
					placeholder="Дюна, Кинг, киберпанк…"
					aria-label="Найти в каталоге"
					class="input w-full bg-base-100/70 input-lg"
				/>
				<button class="btn btn-lg btn-primary">Найти</button>
			</form>
			<!-- Охват каталога виден сразу, до скролла. -->
			<nav aria-label="Разделы каталога" class="mt-4 flex flex-wrap gap-2">
				{#each KINDS as k (k.slug)}
					<a href="/{k.slug}" class="btn btn-ghost btn-sm">{k.title}</a>
				{/each}
				<a href="/collections" class="btn btn-ghost btn-sm">Коллекции</a>
			</nav>
		</div>
	</div>
</section>

{#if data.featured.length}
	<section class="mb-10" aria-labelledby="featured-collections">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<h2 id="featured-collections" class="text-xl font-bold">Подборки</h2>
			<a href="/collections/featured" class="link text-sm link-primary link-hover">Все →</a>
		</div>
		<!-- Одна подборка занимает всю ширину: половина пустой сетки выглядит как недогруз. -->
		<ul class={['grid gap-4', data.featured.length > 1 && 'sm:grid-cols-2']} aria-label="Подборки">
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
