<script lang="ts">
	import { navigating } from '$app/state';
	import type { Production } from '#lib/catalog/card.ts';
	import StudioLogo from '#lib/components/catalog/StudioLogo.svelte';

	// Производство и факты — боковая колонка рядом с таблицей «О фильме» (на телефоне — под ней):
	// студии (у фильмов и сериалов — ссылки на их страницы с логотипом; у игр — разработчик и
	// издатель, у книг — издательство), награды, факты. Данные — productionOf(); пустой раздел не
	// рисуется, пустой блок целиком — тоже (страница). Первое открытие студии бэкенд дополняет из
	// TMDB (1–2 с) — пока идёт переход, на месте логотипа крутится индикатор.
	let { production }: { production: Production } = $props();

	const wins = $derived(production.awards.filter((a) => a.won));
	const nominations = $derived(production.awards.filter((a) => !a.won));
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

<aside
	aria-labelledby="production-title"
	class="flex h-fit flex-col divide-y divide-base-content/10 rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 sm:p-7 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
>
	<h2 id="production-title" class="font-bold">Производство и факты</h2>

	{#if production.studios.length}
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

	{#if production.awards.length}
		<div class="flex flex-col gap-3">
			{#if wins.length}
				<div>
					{@render heading('Награды')}
					{@render awardList(wins, 'Награды')}
				</div>
			{/if}
			{#if nominations.length}
				<div>
					{@render heading('Номинации')}
					{@render awardList(nominations, 'Номинации')}
				</div>
			{/if}
		</div>
	{/if}

	{#if production.trivia.length}
		<div>
			{@render heading(production.triviaTitle)}
			<ul class="flex list-disc flex-col gap-1.5 pl-4 marker:text-primary">
				{#each production.trivia as fact, i (i)}<li>{fact}</li>{/each}
			</ul>
		</div>
	{/if}
</aside>
