<script lang="ts">
	import { navigating } from '$app/state';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import type { Production } from '#lib/catalog/card.ts';
	import { editionHref } from '#lib/catalog/awards.ts';
	import { compact } from '#lib/catalog/labels.ts';
	import AwardLogo from '#lib/components/catalog/AwardLogo.svelte';
	import StudioLogo from '#lib/components/catalog/StudioLogo.svelte';

	// Производство и факты — боковая колонка рядом с таблицей «О фильме» (на телефоне — под ней):
	// студии (у фильмов и сериалов — ссылки на их страницы с логотипом; у игр — разработчик и
	// издатель, у книг — издательство), награды, факты. Данные — productionOf(); пустой раздел не
	// рисуется, пустой блок целиком — тоже (страница). Первое открытие студии бэкенд дополняет из
	// TMDB (1–2 с) — пока идёт переход, на месте логотипа крутится индикатор.
	let {
		entity,
		production
	}: {
		entity: SchemaEntityDetail;
		/** Студии, награды и факты; null — их нет, но колонка может быть нужна ради рейтинга. */
		production?: Production | null;
	} = $props();

	// Награды — значками: логотип премии (или статуэтка), победы впереди. Что именно за награда,
	// говорит подсказка при наведении — списком «Лучшие визуальные эффекты» они занимали экран,
	// а сама премия узнаётся по значку.
	const trophies = $derived(
		entity.awards.toSorted(
			(a, b) =>
				Number(b.won) - Number(a.won) ||
				a.year - b.year ||
				a.award.title.localeCompare(b.award.title, 'ru')
		)
	);
	/** Текстовые награды из metadata — запасной путь, когда структурированных нет. */
	const plainAwards = $derived(trophies.length ? [] : (production?.awards ?? []));
	/** Рейтинг IMDb есть в каталоге, но на карточке его до сих пор не показывали. */
	const imdb = $derived(entity.imdb_rating ?? null);
</script>

{#snippet heading(text: string)}
	<h3 class="mb-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase">{text}</h3>
{/snippet}

{#snippet awardList(items: Production['awards'], label: string)}
	<ul class="flex flex-col gap-1.5" aria-label={label}>
		{#each items as award, i (i)}
			<li class="flex items-start gap-2">
				<span aria-hidden="true" class={{ 'opacity-40 grayscale': !award.won }}>🏆</span>
				<span>
					{award.title}{#if award.year}<span class="text-base-content/45">
							· {award.year}</span
						>{/if}
				</span>
			</li>
		{/each}
	</ul>
{/snippet}

<!-- Заголовка у колонки нет: рядом стоит «О фильме», и второй заголовок в ряд читался как
     отдельный раздел. Блоки внутри подписаны сами — IMDB, СТУДИИ, НАГРАДЫ, ФАКТЫ. -->
<aside
	aria-label="Справка о работе"
	class="flex h-fit flex-col divide-y divide-base-content/10 rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 sm:p-7 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
>
	<!-- Рейтинг IMDb — не наша оценка: подписан явно, чтобы не путали с оценкой в шапке. -->
	{#if imdb}
		<div class="flex items-baseline gap-2">
			<span class="text-xs font-semibold tracking-widest text-base-content/50 uppercase">IMDb</span>
			<span class="text-lg font-bold tabular-nums">{imdb.toFixed(1).replace('.', ',')}</span>
			{#if entity.imdb_votes}
				<span class="text-xs text-base-content/45">{compact(entity.imdb_votes)} голосов</span>
			{/if}
		</div>
	{/if}

	{#if production?.studios.length}
		<div>
			{@render heading(production.studiosTitle)}
			<ul class="flex flex-wrap gap-1.5">
				{#each production.studios as studio (studio.name)}
					{@const opening = !!studio.href && navigating.to?.url.pathname === studio.href}
					<li>
						{#if studio.href}
							<a
								href={studio.href}
								class="badge h-auto min-h-6 gap-1.5 border-base-300 bg-base-100 py-0.5 transition-colors hover:border-primary hover:text-primary"
								aria-busy={opening}
							>
								{#if opening}
									<span class="loading loading-xs loading-spinner"></span>
								{:else}
									<StudioLogo url={studio.logoUrl} />
								{/if}
								{studio.name}
							</a>
						{:else}
							<span class="badge border-base-300 bg-base-100">{studio.name}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if trophies.length}
		<div>
			{@render heading('Награды')}
			<ul class="flex flex-wrap gap-2" aria-label="Награды и номинации">
				{#each trophies as item, i (i)}
					{@const what = `${item.award.title} ${item.year} · ${item.category.title}${item.won ? '' : ' · номинация'}`}
					<li>
						<!-- Подсказка видна при наведении, а для скринридера то же самое в aria-label. -->
						<a
							href={editionHref(item.award.slug, item.year)}
							class={[
								'tooltip block rounded-box ring-1 transition hover:ring-primary',
								item.won ? 'ring-base-content/15' : 'opacity-60 ring-transparent grayscale'
							]}
							data-tip={what}
							aria-label={what}
						>
							<AwardLogo title={item.award.title} logoUrl={item.award.logo_url} size="size-10" />
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if plainAwards.length}
		<div>
			{@render heading('Награды')}
			{@render awardList(plainAwards, 'Награды')}
		</div>
	{/if}

	{#if production?.trivia.length}
		<div>
			{@render heading(production.triviaTitle)}
			<ul class="flex list-disc flex-col gap-1.5 pl-4 marker:text-primary">
				{#each production.trivia as fact, i (i)}<li>{fact}</li>{/each}
			</ul>
		</div>
	{/if}
</aside>
