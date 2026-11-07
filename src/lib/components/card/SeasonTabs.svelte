<script lang="ts">
	import type { SchemaSeasonSummary } from '#lib/api/generated/catalog.ts';
	import { episodesCount, seasonHref, seasonTab } from '#lib/catalog/seasons.ts';

	// Переключатель сезонов под шапкой сериала: «Весь сериал · 1 сезон · 2 сезон». Это ссылки, а
	// не вкладки: у сезона своя страница (/series/arcane/season-2), свои оценки и рецензии, и её
	// должно быть видно поисковику — «аркейн 2 сезон» спрашивают отдельно от «аркейн».
	//
	// Рейтинг и число серий написаны прямо на таблетке: они приходят вместе со списком сезонов,
	// второго запроса за ними нет.
	let {
		seriesSlug,
		seasons,
		active = null
	}: {
		seriesSlug: string;
		seasons: SchemaSeasonSummary[];
		/** slug открытого сезона; null — открыт сам сериал («Весь сериал»). */
		active?: string | null;
	} = $props();
</script>

<!-- Лента таблеток: на телефоне листается пальцем, полосы прокрутки не видно. -->
<nav class="scrollbar-hide -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 py-1" aria-label="Сезоны">
	<a
		href="/series/{seriesSlug}"
		aria-current={active === null ? 'page' : undefined}
		class={[
			'flex shrink-0 items-center rounded-box px-5 py-3 text-sm font-semibold transition',
			active === null
				? 'bg-primary text-primary-content shadow-lg shadow-primary/20'
				: 'bg-base-200 text-base-content/80 ring-1 ring-base-content/10 hover:bg-base-300 hover:text-base-content'
		]}>Весь сериал</a
	>

	{#each seasons as season (season.id)}
		{@const current = season.slug === active}
		<a
			href={seasonHref(seriesSlug, season.number)}
			aria-current={current ? 'page' : undefined}
			class={[
				'flex shrink-0 flex-col justify-center rounded-box px-5 py-2 text-sm font-semibold transition',
				current
					? 'bg-primary text-primary-content shadow-lg shadow-primary/20'
					: 'bg-base-200 text-base-content/80 ring-1 ring-base-content/10 hover:bg-base-300 hover:text-base-content'
			]}
		>
			{seasonTab(season)}
			<!-- Вторая строка — только когда есть что сказать: у сезона без оценок и без серий
			     пустая строка просто растягивала бы таблетку. -->
			{#if season.rating.value || season.episode_count}
				<span
					class={[
						'text-xs font-medium',
						current ? 'text-primary-content/75' : 'text-base-content/50'
					]}
				>
					{#if season.rating.value}★ {season.rating.value.toLocaleString('ru-RU')}{/if}
					{#if season.rating.value && season.episode_count}&nbsp;·&nbsp;{/if}
					{#if season.episode_count}{episodesCount(season.episode_count)}{/if}
				</span>
			{/if}
		</a>
	{/each}
</nav>
