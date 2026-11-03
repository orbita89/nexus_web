<script lang="ts">
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import GenreTiles from '#lib/components/catalog/GenreTiles.svelte';
	import ContinueStrip from '#lib/components/catalog/ContinueStrip.svelte';
	import PeopleStrip from '#lib/components/catalog/PeopleStrip.svelte';
	import RoomIcon from '#lib/components/chat/RoomIcon.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import HeroSearch from '#lib/components/catalog/HeroSearch.svelte';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';
	import { activityLabel } from '#lib/chat/rooms.ts';
	import { count } from '#lib/catalog/labels.ts';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagChips from '#lib/components/catalog/TagChips.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Пустой раздел на главной не показываем; ошибку — показываем один раз, а не в каждой полосе.
	const filled = $derived(data.sections.filter((s) => s.result.data?.items.length));
	const failed = $derived(data.sections.find((s) => s.result.error)?.result.error);
	// Блок жанров — не в конце страницы, а между полосами: пять одинаковых лент подряд читаются
	// как одна. После второй полосы он даёт паузу и второй способ войти в каталог.
	const BREAK_AFTER = 2;
</script>

<Seo
	title="Фильмы, сериалы, книги и игры"
	description="Кассандра — каталог фильмов, сериалов, книг и игр: оценки, рецензии, коллекции и обсуждения, привязанные к произведениям."
/>

<!-- Первый экран во всю ширину окна: выходит из колонки main (100cqw — ширина страницы
     без панели чата) и подтягивается под шапку. Не на всю высоту окна (88vh): из-за нижнего
     края выглядывает заголовок «Подборок» — видно, что страница продолжается. -->
<section
	class="relative mx-[calc(50%-50cqw)] -mt-[5.5rem] mb-10 flex min-h-[30rem] w-[100cqw] flex-col justify-center pt-[8rem] pb-12 sm:min-h-[70vh]"
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
		<!-- Подложка под текстом: на широком экране слева (арт по краям остаётся виден), на узком
		     текст лежит прямо на картине — там она затемняется целиком, иначе подзаголовок
		     попадал на светлое лицо и не читался. -->
		<div
			class="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(9,9,11,0.55)_0%,rgba(9,9,11,0.75)_60%,rgba(9,9,11,0.85)_100%)] sm:bg-[linear-gradient(to_right,rgba(9,9,11,0.88)_0%,rgba(9,9,11,0.6)_28%,transparent_55%)]"
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
		<!-- Цифра под поиском: сумма разделов из тех же запросов, что и полосы — отдельного
		     запроса не стоит, а на вопрос «что тут вообще есть» отвечает сразу. -->
		{#if data.total}
			<p class="mt-4 text-sm text-base-content/50 drop-shadow-[0_1px_8px_rgba(9,9,11,0.8)]">
				{count(data.total, ['произведение', 'произведения', 'произведений'])} на сайте{#if data.archive}
					<span class="mx-1 text-base-content/30">·</span>ещё
					{count(data.archive, ['фильм', 'фильма', 'фильмов'])} в архиве{/if}
			</p>
		{/if}
	</div>
</section>

<!-- Своё — выше общего: вошедший продолжает с отложенного, гость этого блока не видит. -->
<ContinueStrip />

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

{#each filled as section, i (section.slug)}
	<section class="mb-10" aria-labelledby="new-{section.slug}">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<!-- Без приписки «новинки»: полосы грузятся порядком «Рекомендуемые», и новым тут
			     оказывается не всё — подпись обещала то, чего в полосе нет. -->
			<h2 id="new-{section.slug}" class="text-xl font-bold">{section.title}</h2>
			<a href="/{section.slug}" class="link text-sm link-primary link-hover">Все →</a>
		</div>
		<!-- Картины — широкими карточками: холст вписан в плитку целиком, и в постерной ширине
		     «Герника» не отличалась от марки на конверте. -->
		<PosterStrip
			entities={section.result.data!.items}
			label="Новинки: {section.title}"
			ratings={data.ratings}
			wide={i === 0 || section.kind === 'painting'}
		/>
	</section>

	{#if i === BREAK_AFTER - 1 && data.genres.length}
		<section class="mb-10" aria-labelledby="genres">
			<div class="mb-3 flex items-baseline justify-between gap-4">
				<h2 id="genres" class="text-xl font-bold">Жанры</h2>
				<a href="/genres" class="link text-sm link-primary link-hover">Все жанры →</a>
			</div>
			<GenreTiles tiles={data.genres} />
		</section>
	{/if}
{/each}

<!-- Дальше — то, чего нет в разделах: общая лента по оценкам, люди и живой форум. Без них
     страница кончалась пятью полосами каталога и footer'ом. -->
{#if data.rated.length}
	<section class="mb-10" aria-labelledby="top-rated">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<!-- Без пояснения «фильмы и книги вместе»: порядок top_rated ведёт рейтинг IMDb, и на
			     деле в ленте одни фильмы — подпись обещала бы то, чего в ней нет. -->
			<h2 id="top-rated" class="text-xl font-bold">Высокий рейтинг</h2>
			<a href="/search?sort=top_rated" class="link text-sm link-primary link-hover">Все →</a>
		</div>
		<PosterStrip entities={data.rated} label="Высокий рейтинг" ratings={data.ratings} showKind />
	</section>
{/if}

<!-- Сообщество — отдельная зона: своя подложка во всю ширину окна отделяет «кто здесь» от
     каталожных полос выше, и страница читается как три части — найти, посмотреть, поговорить. -->
{#if data.people.length || data.rooms.length}
	<section
		class="relative mx-[calc(50%-50cqw)] mb-10 w-[100cqw] border-y border-base-300 bg-base-200/40 py-10"
	>
		<div class="mx-auto w-full max-w-6xl px-4">
			{#if data.people.length}
				<section class="mb-10" aria-labelledby="people">
					<div class="mb-3 flex items-baseline justify-between gap-4">
						<h2 id="people" class="text-xl font-bold">Люди</h2>
						<a href="/people" class="link text-sm link-primary link-hover">Все люди →</a>
					</div>
					<PeopleStrip people={data.people} label="Популярные люди" />
				</section>
			{/if}

			{#if data.rooms.length}
				<section class="mb-10" aria-labelledby="chat-rooms">
					<div class="mb-3 flex items-baseline justify-between gap-4">
						<h2 id="chat-rooms" class="text-xl font-bold">Каналы</h2>
						<a href="/chat" class="link text-sm link-primary link-hover">Все каналы →</a>
					</div>
					<!-- Каналы, а не темы форума: форум ещё не доделан, а в чате уже разговаривают.
			     Карточка — как в каталоге комнат, только без кнопок вступления. -->
					<ul class="grid gap-3 sm:grid-cols-2" aria-label="Каналы">
						{#each data.rooms as room (room.id)}
							{@const meta = {
								room: `room:${room.slug}`,
								title: room.title,
								href: '/chat',
								image: null
							}}
							<li>
								<a
									href="/chat"
									class="flex h-full items-start gap-4 rounded-box bg-base-200 p-4 ring-1 ring-base-300 transition hover:-translate-y-0.5 hover:ring-primary"
								>
									<RoomIcon {meta} size="size-12" />
									<span class="min-w-0 flex-1">
										<span class="flex items-center gap-2 font-bold">
											<span class="truncate">{room.title}</span>
											{#if room.system}<span class="badge shrink-0 badge-ghost badge-sm">общая</span
												>{/if}
										</span>
										{#if room.description}
											<span class="mt-1 line-clamp-2 block text-sm text-base-content/70"
												>{room.description}</span
											>
										{/if}
										<span class="mt-1 block text-xs text-base-content/50">
											{count(room.members_count, ['участник', 'участника', 'участников'])}
											{#if activityLabel(room)}
												· <span class="font-bold text-success">{activityLabel(room)}</span>
											{/if}
										</span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</section>
{/if}

{#if !failed && filled.length === 0}
	<EmptyState title="Каталог пока пуст"
		>Скоро здесь появятся фильмы, сериалы, книги и игры.</EmptyState
	>
{/if}

{#if data.themes.length}
	<section aria-labelledby="popular-tags" class="mb-6">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<h2 id="popular-tags" class="text-xl font-bold">Теги</h2>
			<a href="/tags" class="link text-sm link-primary link-hover">Все теги →</a>
		</div>
		<!-- Теги — поперёк разделов («Экранизация», «Открытый мир»), поэтому без чисел: здесь
		     важно само название, а счётчик уводит взгляд с него. Жанры выше, отдельным блоком. -->
		<TagChips tags={data.themes} label="Популярные теги" counts={false} />
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
