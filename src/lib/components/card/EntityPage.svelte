<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { aboutTitle, isReleased, productionOf, worthWatching } from '#lib/catalog/card.ts';
	import { entityHref, kindByApi } from '#lib/catalog/kinds.ts';
	import { summary, yearOf } from '#lib/catalog/labels.ts';
	import { trailerSources } from '#lib/catalog/trailer.ts';
	import About from '#lib/components/card/About.svelte';
	import ActivityFeed from '#lib/components/card/ActivityFeed.svelte';
	import AverageRating from '#lib/components/card/AverageRating.svelte';
	import EntityLike from '#lib/components/card/EntityLike.svelte';
	import Hero from '#lib/components/card/Hero.svelte';
	import MarkButtons from '#lib/components/card/MarkButtons.svelte';
	import MoreMenu from '#lib/components/card/MoreMenu.svelte';
	import MyNote from '#lib/components/card/MyNote.svelte';
	import Production from '#lib/components/card/Production.svelte';
	import RateButton from '#lib/components/card/RateButton.svelte';
	import SectionNav from '#lib/components/card/SectionNav.svelte';
	import Reactions from '#lib/components/card/Reactions.svelte';
	import Recommendations from '#lib/components/card/Recommendations.svelte';
	import Related from '#lib/components/card/Related.svelte';
	import StickyHeader from '#lib/components/card/StickyHeader.svelte';
	import ClientSection from '#lib/components/catalog/ClientSection.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import AddToCollection from '#lib/components/social/AddToCollection.svelte';
	import CardCollections from '#lib/components/social/CardCollections.svelte';

	import ShareMenu from '#lib/components/social/ShareMenu.svelte';
	import WatchButton from '#lib/components/social/WatchButton.svelte';
	import ChatActivity from '#lib/components/chat/ChatActivity.svelte';
	import { useRealtime } from '#lib/realtime/realtime.svelte.ts';
	import { browserApi, CardLive, liveQuery } from '#lib/social/card-live.svelte.ts';
	import { Marks } from '#lib/social/marks.svelte.ts';
	import { MyReviewState } from '#lib/social/my-review.svelte.ts';
	import { provideMyVotes } from '#lib/social/review-votes.svelte.ts';
	import { Watch } from '#lib/social/watch.svelte.ts';
	import Analysis from '#lib/components/card/Analysis.svelte';
	import ArtistWorks from '#lib/components/card/ArtistWorks.svelte';
	import FragmentStrip from '#lib/components/card/FragmentStrip.svelte';
	import SeasonTabs from '#lib/components/card/SeasonTabs.svelte';
	import EpisodeStrip from '#lib/components/card/EpisodeStrip.svelte';
	import { analysisOf, canvasOf, type ViewerFocus } from '#lib/catalog/paintings.ts';
	import type {
		SchemaEntityDetail,
		SchemaEpisode,
		SchemaSeasonSummary
	} from '#lib/api/generated/catalog.ts';

	// Карточка сверху вниз:
	// 1. Липкая мини-шапка (только телефон) — когда первый экран ушёл вверх.
	// 2. Первый экран: есть трейлер — шапка как у Okko (трейлер фоном, без постера); нет — постер
	//    и текст. Кнопки: «Оценить» (1–10 и реакции), средняя оценка, «Нравится», «В коллекцию», «Следить».
	// 3. Теги, затем «О фильме»: таблица как у Кинопоиска, справа от неё «Производство и факты»,
	//    ниже плашка «режиссёр и актёры». 4. Приквелы, сиквелы и ремейки (только если есть),
	//    затем «Рекомендации» (заглушка, пока нет API).
	// 5. Ленивая зона: рецензии и обсуждения одной лентой, коллекции.
	//
	// Страница статическая (+page.server.ts): в data только каталог, и всё из него — в HTML.
	// Личное и живое (оценки, «Следить», рецензии, темы, коллекции) грузится в браузере: сводка
	// оценок — сразу (бейдж в шапке), остальное — ClientSection, когда блок подходит к экрану.
	//
	// Сериал и его сезон — одна и та же страница: у сезона свой slug, свои оценки, рецензии и
	// коллекции, то есть всё, что здесь уже собрано вокруг `entity.slug`. Разница только в
	// переключателе сезонов (seasons) и ленте серий (episodes), которые приходят сверху.
	let {
		entity,
		seasons = [],
		episodes = [],
		/** Сериал открытого сезона: адреса таблеток и ссылка над названием. */
		series = null
	}: {
		entity: SchemaEntityDetail;
		seasons?: SchemaSeasonSummary[];
		episodes?: SchemaEpisode[];
		series?: { slug: string; title: string } | null;
	} = $props();

	// Картина: исходник для увеличения, фрагменты полотна и разбор. Всё трое — только у картин, и
	// любого может не быть: фрагменты и разбор пишет человек, и на большинстве холстов их нет.
	// Пустых заголовков в таком случае не остаётся — блоков просто нет.
	const canvas = $derived(canvasOf(entity));
	const analysis = $derived(analysisOf(entity));
	/** Фрагмент, на котором открыть холст: лента деталей кладёт сюда кроп. */
	let openCrop = $state<ViewerFocus | null>(null);

	/** Художник картины: строка над названием и лента «Другие работы художника». */
	const artist = $derived.by(() => {
		if (entity.kind !== 'painting') return null;
		const credit = entity.credits.find((c) => c.role === 'artist');
		return credit ? { slug: credit.person.slug, name: credit.person.full_name } : null;
	});

	/** Автор книги: от него строится «Ещё книги автора». */
	const bookAuthor = $derived.by(() => {
		if (entity.kind !== 'book') return null;
		const credit = entity.credits.find((c) => c.role === 'author');
		return credit ? { slug: credit.person.slug, name: credit.person.full_name } : null;
	});

	// Над названием: у сезона — сериал («Сезон 2» сам по себе не говорит ничего), у картины —
	// художник и год, как подпись на музейной табличке.
	const seriesParent = $derived.by(() => {
		if (series) return { title: series.title, href: `/series/${series.slug}` };
		if (artist)
			return {
				title: year ? `${artist.name} · ${year} г.` : artist.name,
				href: `/people/${artist.slug}`
			};
		return null;
	});

	let heroElement = $state<HTMLElement>();

	const kind = $derived(kindByApi(entity.kind));
	const year = $derived(yearOf(entity.release_date));
	const trailers = $derived(trailerSources(entity));
	const production = $derived(productionOf(entity));

	// Вышло ли — по часам зрителя, не сборки: статика живёт дольше дня премьеры. До гидрации
	// считаем вышедшим — зависящее от этого и так рисуется только в браузере.
	let today = $state<string | null>(null);
	onMount(() => (today = new Date().toISOString().slice(0, 10)));
	const released = $derived(today === null || isReleased(entity.release_date, today));
	// «Следить» отдельной кнопкой — только когда есть чего ждать: до премьеры и у идущего
	// сериала. У вышедшего фильма новостей не будет, и колокольчик уходит в меню «⋯».
	const waiting = $derived(worthWatching(entity, released));
	// Разделы для навигации — только те, что действительно будут на странице. «Рекомендации»
	// грузятся в браузере и могут оказаться пустыми, поэтому их в полосе нет.
	const hasCast = $derived(
		entity.credits.some((c) => c.role === 'actor' || c.role === 'voice_actor')
	);
	const sections = $derived(
		[
			{ id: 'about', title: aboutTitle(entity.kind) },
			episodes.length ? { id: 'episodes', title: 'Серии' } : null,
			analysis ? { id: 'analysis', title: 'Разбор' } : null,
			entity.fragments.length ? { id: 'fragments', title: 'Детали' } : null,
			hasCast ? { id: 'credits', title: 'В ролях' } : null,
			entity.related.length ? { id: 'related', title: 'Связанные' } : null,
			session.status === 'authed' ? { id: 'note', title: 'Заметка' } : null,
			{ id: 'activity', title: 'Рецензии' },
			{ id: 'collections', title: 'В коллекциях' }
		].filter((s): s is { id: string; title: string } => !!s)
	);

	// Чужие рецензии, комментарии к ним (review.commented / review.comment_deleted — у рецензии
	// меняется comments_count, открытый список перечитывается сам) и темы — тихо перечитываем всё
	// живое (пачку событий — одним разом); свои действия — тоже через live.refresh().
	const live = new CardLive();
	const rating = liveQuery(
		() => ({ slug: entity.slug, version: live.version }),
		({ slug }) =>
			unwrap(
				browserApi().social.GET('/api/v1/social/entities/{slug}/rating', {
					params: { path: { slug } }
				})
			)
	);
	/** undefined — ещё грузится (в статике — всегда), null — оценок нет или ещё не вышло. */
	const average = $derived.by(() => {
		if (!released) return null;
		const loaded = rating.current;
		if (!loaded) return undefined;
		return loaded.data?.count ? (loaded.data.average ?? null) : null;
	});

	// Одно состояние на страницу: «Следить» — шапка и липкая шапка; своя рецензия — «Оценить» в
	// шапке и форма в ленте.
	const watch = new Watch(
		() => entity.slug,
		() => entity.id
	);
	// «Посмотреть позже» / «Просмотрено» — своя отметка, с токеном.
	const viewing = new Marks(() => entity.slug);
	// Свои голоса за рецензии — одним запросом на карточку, для всех рецензий ленты.
	provideMyVotes(() => entity.slug);
	const my = new MyReviewState(
		() => entity.slug,
		() => live.refresh()
	);

	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	function refreshSoon() {
		clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => live.refresh(), 800);
	}
	useRealtime(
		() => [`entity:${entity.slug}`],
		(event) => {
			if (event.data.author_id === session.user?.id) return;
			// entity.reacted — кто-то поставил эмодзи: в событии только id, какое именно — узнаём,
			// перечитав строку реакций (её версия меняется вместе с live).
			if (
				event.event.startsWith('review.') ||
				event.event.startsWith('thread.') ||
				event.event === 'entity.reacted'
			)
				refreshSoon();
		},
		refreshSoon
	);

	const description = $derived(
		summary(entity.description) ||
			`${kind.one} «${entity.title}»${year ? ` (${year})` : ''}: оценки, рецензии и обсуждения в Кассандра.`
	);
</script>

<Seo title="{entity.title}{year ? ` (${year})` : ''}" {description} image={entity.cover_url} />

<!-- key — у новой карточки всё заново: трейлер, ленивость блоков, «Читать далее». -->
{#key entity.id}
	<StickyHeader
		hero={heroElement}
		title={entity.title}
		kind={entity.kind}
		coverUrl={entity.cover_url}
		{watch}
	/>

	<!-- Свой слой поверх разделов ниже (панель «Оценить» выпадает на них), но под шапкой сайта
	     (z-20): у CardHero transform, без z-index его перекрывали бы вкладки «О фильме». -->
	<div bind:this={heroElement} class="relative z-15">
		<Hero {entity} {trailers} parent={seriesParent} {canvas} bind:openCrop>
			{#snippet marks()}
				<!-- Реакции — отдельной строкой под кнопками, на всю ширину: их ставят в одно нажатие,
				     и читают их все, включая гостей. -->
				<Reactions slug={entity.slug} {released} version={live.version} />
			{/snippet}
			{#snippet actions()}
				<!-- Один ряд вместо трёх: главное — «Оценить», рядом сердечко, отметка и чат, всё
				     редкое — в «⋯». Восемь равных кнопок не давали глазу зацепиться ни за одну. -->
				<!-- «Оценить» — первой: это главное действие, остальное идёт за ним. -->
				<RateButton {my} {released} releaseDate={entity.release_date} />
				<!-- Вторичные кнопки — отдельным рядом: на телефоне под «Оценить», на md и шире — в общем ряду. -->
				<div class="flex flex-wrap items-center gap-2 md:contents">
					<AverageRating {average} total={rating.current?.data?.count ?? 0} />
				<EntityLike slug={entity.slug} />
				<!-- Отметка одна: «позже» и «просмотрено» взаимоисключающие. У картины её нет —
				     холст не откладывают на вечер. -->
				{#if entity.kind !== 'painting'}
					<MarkButtons marks={viewing} kind={entity.kind} />
				{/if}
				<ChatActivity
					kind="entity"
					slug={entity.slug}
					meta={{
						room: `entity:${entity.slug}`,
						title: entity.title,
						href: entityHref(entity),
						image: entity.cover_url ?? null
					}}
				/>
				{#if waiting}
					<!-- Ждём премьеру или новый сезон — тогда «Следить» на виду. -->
					<WatchButton {watch} />
				{/if}
				<MoreMenu>
					<AddToCollection
						slug={entity.slug}
						title={entity.title}
						onchange={() => live.refresh()}
						menu
					/>
					{#if !waiting}
						<WatchButton {watch} menu />
					{/if}
					<ShareMenu url={page.url.href} title={entity.title} />
					</MoreMenu>
				</div>
			{/snippet}
		</Hero>
	</div>

	<!-- Сезоны — сразу под шапкой, до полосы разделов: это переход на другую страницу, а не
	     прокрутка к разделу этой, и смешивать их в одной полосе нельзя. -->
	{#if seasons.length && (series || entity.kind === 'series')}
		<SeasonTabs
			seriesSlug={series?.slug ?? entity.slug}
			{seasons}
			active={entity.kind === 'season' ? entity.slug : null}
		/>
	{/if}

	<!-- Полоса разделов: карточка длинная, и без неё не видно, что на ней есть. -->
	<SectionNav hero={heroElement} {sections} />

	{#if production || entity.imdb_rating || entity.awards.length}
		<About {entity} factsInHero={!trailers.length && entity.kind !== 'painting'}>
			{#snippet aside()}<Production {entity} {production} />{/snippet}
		</About>
	{:else}
		<About {entity} factsInHero={!trailers.length && entity.kind !== 'painting'} />
	{/if}

	<!-- Разбор — отдельным разделом под таблицей, во всю ширину: в боковой колонке он тянул её на
	     два экрана ниже фактов, и слева зияла пустота. -->
	{#if analysis}
		<Analysis {analysis} />
	{/if}

	<!-- Детали полотна — сразу под «О картине»: нажатие открывает холст на этом месте. -->
	{#if entity.fragments.length && canvas}
		<FragmentStrip
			fragments={entity.fragments}
			{canvas}
			onopen={(fragment) =>
				(openCrop = {
					crop: fragment.crop,
					title: fragment.title,
					description: fragment.description
				})}
		/>
	{/if}

	<!-- Серии открытого сезона — сразу под «О сезоне»: ради них на страницу и пришли. -->
	{#if episodes.length}
		<EpisodeStrip {episodes} fallbackCover={entity.cover_url} />
	{/if}

	<!-- Приквелы, сиквелы, ремейки — только если есть; рекомендации — заглушкой, пока нет API. -->
	<Related {entity} />
	<!-- У картины вместо общих рекомендаций — работы того же художника: с холста уходят в
	     соседний зал того же автора, а не к «похожей картине вообще». -->
	{#if artist}
		<ArtistWorks slug={entity.slug} {artist} />
	{:else}
		<!-- У книги «Ещё книги автора» — рядом с рекомендациями, а не вместо них. -->
		{#if bookAuthor}
			<ArtistWorks slug={entity.slug} artist={bookAuthor} role="author" kind="book" />
		{/if}
		<Recommendations slug={entity.slug} />
	{/if}

	<!-- Ленивая зона: в статический HTML входят только заголовки и заглушки. Блок монтируется,
	     когда раздел подходит к экрану, и сам грузит данные из API. -->
	<!-- Личная заметка — перед публичными рецензиями: это запись для себя, и её место рядом с
	     произведением, а не в ленте. У гостя блока нет. -->
	<MyNote slug={entity.slug} />

	<ClientSection id="activity" title="Рецензии и обсуждения" placeholder="h-80">
		<ActivityFeed slug={entity.slug} {live} {my} {released} />
	</ClientSection>

	<ClientSection id="collections" title="В коллекциях" placeholder="h-40">
		<CardCollections slug={entity.slug} {live} />
	</ClientSection>
{/key}
