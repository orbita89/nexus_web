<script lang="ts">
	import type {
		SchemaBookMetadata,
		SchemaEntityDetail,
		SchemaGameMetadata
	} from '#lib/api/generated/catalog.ts';

	// Производство и факты — боковая колонка рядом с таблицей «О фильме» (на телефоне — под ней):
	// студии и компании, награды, интересные факты о съёмках. В каталоге
	// пока есть только разработчик и издатель у игр и издатель у книг — остальное заглушками,
	// поля нужны от бэкенда (docs/backend-questions.md). Когда появятся — придут через props.
	let {
		entity,
		awards = [],
		trivia = []
	}: {
		entity: SchemaEntityDetail;
		awards?: { title: string; year?: number; won: boolean }[];
		trivia?: string[];
	} = $props();

	const studios = $derived.by(() => {
		if (entity.kind === 'game') {
			const m = entity.metadata as SchemaGameMetadata;
			return [m.developer, m.publisher].filter((s): s is string => !!s);
		}
		if (entity.kind === 'book') {
			const m = entity.metadata as SchemaBookMetadata;
			return m.publisher ? [m.publisher] : [];
		}
		return [];
	});
	const studiosTitle = $derived(
		entity.kind === 'book'
			? 'Издательство'
			: entity.kind === 'game'
				? 'Разработка и издание'
				: 'Студии'
	);
	const triviaTitle = $derived(
		entity.kind === 'book'
			? 'Интересные факты'
			: entity.kind === 'game'
				? 'Факты о разработке'
				: 'Факты о съёмках'
	);
</script>

{#snippet heading(text: string)}
	<h3 class="mb-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase">{text}</h3>
{/snippet}

{#snippet empty(text: string)}
	<p class="text-base-content/40">{text}</p>
{/snippet}

<aside
	aria-labelledby="production-title"
	class="flex h-fit flex-col divide-y divide-base-content/10 rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 sm:p-7 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
>
	<h2 id="production-title" class="font-bold">Производство и факты</h2>

	<div>
		{@render heading(studiosTitle)}
		{#if studios.length}
			<ul class="flex flex-wrap gap-1.5">
				{#each studios as studio (studio)}<li class="badge border-base-300 bg-base-100">
						{studio}
					</li>{/each}
			</ul>
		{:else}
			{@render empty('Компании появятся позже.')}
		{/if}
	</div>

	<div>
		{@render heading('Награды')}
		{#if awards.length}
			<ul class="flex flex-col gap-1.5">
				{#each awards as award, i (i)}
					<li class="flex items-start gap-2">
						<span aria-hidden="true" class={{ grayscale: !award.won }}>🏆</span>
						<span>
							{award.title}{#if award.year}<span class="text-base-content/45">
									· {award.year}</span
								>{/if}
							{#if !award.won}<span class="text-base-content/45"> · номинация</span>{/if}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="flex gap-1 text-lg opacity-25 grayscale" aria-hidden="true">🏆🏆🏆</p>
			{@render empty('Награды и номинации появятся позже.')}
		{/if}
	</div>

	<div>
		{@render heading(triviaTitle)}
		{#if trivia.length}
			<ul class="flex list-disc flex-col gap-1.5 pl-4 marker:text-primary">
				{#each trivia as fact, i (i)}<li>{fact}</li>{/each}
			</ul>
		{:else}
			{@render empty('Факты появятся позже.')}
		{/if}
	</div>
</aside>
