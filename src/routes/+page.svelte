<script lang="ts">
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import HeroSearch from '#lib/components/catalog/HeroSearch.svelte';
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
	class="relative mx-[calc(50%-50cqw)] -mt-[5.5rem] mb-10 flex min-h-[32rem] w-[100cqw] flex-col justify-center pt-[9rem] pb-14 sm:min-h-screen"
>
	<!-- «Кассандра» Эвелин де Морган в авторской неоновой гамме — она даёт глубину, которой
	     нет у плоской перекраски. Чуть приглушена по насыщенности, чтобы не спорить с
	     оранжевым акцентом. Слой выше самого блока — картина продолжается за «Подборками»
	     и только там гаснет в фон сайта.
	     Файл обрезан по верхние 62% холста — видна всё равно только эта часть, зато пикселей
	     хватает на широкий экран без апскейла, и размытие больше не нужно.
	     AVIF с webp-запаской: то же разрешение почти без потерь и вдвое легче. -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[170%] overflow-hidden sm:h-[125%]"
	>
		<picture class="hero-art block size-full sm:ml-auto sm:w-[86%]">
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
				class="size-full scale-105 object-cover object-[46%_0%] brightness-[0.92] saturate-[0.78] sm:object-[50%_55%]"
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
		<h1
			class="max-w-2xl text-4xl leading-[1.05] font-black tracking-[-0.02em] text-balance drop-shadow-[0_2px_12px_rgba(9,9,11,0.6)] sm:text-5xl lg:text-6xl"
		>
			Всё, что смотрят, читают и проходят
		</h1>
		<!-- Одна строка: разделы каталога и так названы чипами под поиском, здесь — только то,
		     чего в них нет: оценки, рецензии и связь книги с экранизацией. -->
		<p
			class="mt-4 max-w-lg text-base-content/70 drop-shadow-[0_1px_8px_rgba(9,9,11,0.8)] sm:text-lg"
		>
			Оценки, рецензии и обсуждения — от книги до её экранизации.
		</p>
		<!-- Поиск — единственная стеклянная плашка на картине: пилюля «поле + кнопка»,
		     чипы под ней задают, где искать, и подсказки приходят прямо на наборе. -->
		<div class="mt-7"><HeroSearch /></div>
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

<style>
	/* Картина занимает не всю ширину — левый край растушёван, чтобы вместо неё
	   не было видно вертикального шва с фоном. */
	@media (min-width: 40rem) {
		.hero-art {
			-webkit-mask-image: linear-gradient(to right, transparent 0, #000 9%);
			mask-image: linear-gradient(to right, transparent 0, #000 9%);
		}
	}
</style>
