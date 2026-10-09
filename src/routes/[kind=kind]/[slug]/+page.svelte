<script lang="ts">
	import { onMount } from 'svelte';
	import { unwrap } from '#lib/api/errors.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { isReleased } from '#lib/catalog/card.ts';
	import { kindByApi } from '#lib/catalog/kinds.ts';
	import { summary, yearOf } from '#lib/catalog/labels.ts';
	import { trailerSources } from '#lib/catalog/trailer.ts';
	import About from '#lib/components/card/About.svelte';
	import ActivityFeed from '#lib/components/card/ActivityFeed.svelte';
	import AverageRating from '#lib/components/card/AverageRating.svelte';
	import Hero from '#lib/components/card/Hero.svelte';
	import MarkButtons from '#lib/components/card/MarkButtons.svelte';
	import Production from '#lib/components/card/Production.svelte';
	import RateButton from '#lib/components/card/RateButton.svelte';
	import Recommendations from '#lib/components/card/Recommendations.svelte';
	import Related from '#lib/components/card/Related.svelte';
	import StickyHeader from '#lib/components/card/StickyHeader.svelte';
	import ClientSection from '#lib/components/catalog/ClientSection.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagChips from '#lib/components/catalog/TagChips.svelte';
	import AddToCollection from '#lib/components/social/AddToCollection.svelte';
	import CardCollections from '#lib/components/social/CardCollections.svelte';
	import WatchButton from '#lib/components/social/WatchButton.svelte';
	import { useRealtime } from '#lib/realtime/realtime.svelte.ts';
	import { browserApi, CardLive, liveQuery } from '#lib/social/card-live.svelte.ts';
	import { Marks } from '#lib/social/marks.svelte.ts';
	import { MyReviewState } from '#lib/social/my-review.svelte.ts';
	import { Watch } from '#lib/social/watch.svelte.ts';
	import type { PageProps } from './$types';

	// Карточка сверху вниз:
	// 1. Липкая мини-шапка (только телефон) — когда первый экран ушёл вверх.
	// 2. Первый экран: есть трейлер — шапка как у Okko (трейлер фоном, без постера); нет — постер
	//    и текст. Кнопки: средняя оценка, «Оценить» (1–10 и реакции), «В коллекцию», «Следить».
	// 3. Теги, затем «О фильме»: таблица как у Кинопоиска, справа от неё «Производство и факты»,
	//    ниже плашка «режиссёр и актёры». 4. Приквелы, сиквелы и ремейки (только если есть),
	//    затем «Рекомендации» (заглушка, пока нет API).
	// 5. Ленивая зона: рецензии и обсуждения одной лентой, коллекции.
	//
	// Страница статическая (+page.server.ts): в data только каталог, и всё из него — в HTML.
	// Личное и живое (оценки, «Следить», рецензии, темы, коллекции) грузится в браузере: сводка
	// оценок — сразу (бейдж в шапке), остальное — ClientSection, когда блок подходит к экрану.
	let { data }: PageProps = $props();

	let heroElement = $state<HTMLElement>();

	const entity = $derived(data.entity);
	const kind = $derived(kindByApi(entity.kind));
	const year = $derived(yearOf(entity.release_date));
	const trailers = $derived(trailerSources(entity));

	// Вышло ли — по часам зрителя, не сборки: статика живёт дольше дня премьеры. До гидрации
	// считаем вышедшим — зависящее от этого и так рисуется только в браузере.
	let today = $state<string | null>(null);
	onMount(() => (today = new Date().toISOString().slice(0, 10)));
	const released = $derived(today === null || isReleased(entity.release_date, today));

	// Чужие рецензии и темы о произведении — тихо перечитываем всё живое (пачку событий — одним
	// разом); свои действия — тоже через live.refresh().
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
	// «Посмотреть позже» / «Просмотрено» — пока в браузере, API нет.
	const viewing = new Marks(() => entity.slug);
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
			if (event.event.startsWith('review.') || event.event.startsWith('thread.')) refreshSoon();
		},
		refreshSoon
	);

	const description = $derived(
		summary(entity.description) ||
			`${kind.one} «${entity.title}»${year ? ` (${year})` : ''}: оценки, рецензии и обсуждения в Nexus.`
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
		<Hero {entity} {trailers}>
			{#snippet marks()}
				<MarkButtons marks={viewing} kind={entity.kind} />
			{/snippet}
			{#snippet actions()}
				<AverageRating {average} total={rating.current?.data?.count ?? 0} />
				<RateButton {my} slug={entity.slug} {released} releaseDate={entity.release_date} />
				<AddToCollection slug={entity.slug} title={entity.title} onchange={() => live.refresh()} />
				<WatchButton {watch} />
			{/snippet}
		</Hero>
	</div>

	<!-- Теги — над «О фильме». Жанры пока тоже теги; разделят на бэкенде (backend-questions). -->
	{#if entity.tags.length}
		<div class="mb-10"><TagChips tags={entity.tags} /></div>
	{/if}

	<About {entity}>
		{#snippet aside()}<Production {entity} />{/snippet}
	</About>

	<!-- Приквелы, сиквелы, ремейки — только если есть; рекомендации — заглушкой, пока нет API. -->
	<Related {entity} />
	<Recommendations slug={entity.slug} />

	<!-- Ленивая зона: в статический HTML входят только заголовки и заглушки. Блок монтируется,
	     когда раздел подходит к экрану, и сам грузит данные из API. -->
	<ClientSection id="activity" title="Рецензии и обсуждения" placeholder="h-80">
		<ActivityFeed slug={entity.slug} {live} {my} {released} />
	</ClientSection>

	<ClientSection id="collections" title="В коллекциях" placeholder="h-40">
		<CardCollections slug={entity.slug} {live} />
	</ClientSection>
{/key}
