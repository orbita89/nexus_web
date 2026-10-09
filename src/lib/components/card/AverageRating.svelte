<script lang="ts">
	import { page } from '$app/state';
	import { count } from '#lib/catalog/labels.ts';
	import { formatRating } from '#lib/social/reviews.ts';

	// Средняя оценка в шапке перед кнопками — показатель, а не кнопка: оранжевая звезда, крупная
	// цифра, под ней «4 оценки», справа тонкий разделитель. Ссылка — на все рецензии (там
	// распределение). Живая (грузит страница в браузере): пока грузится — место под неё; оценок
	// нет — ничего.
	let { average, total }: { average: number | null | undefined; total: number } = $props();

	const text = $derived(average != null ? formatRating(average, { average: true }) : '');
	const votes = $derived(count(total, ['оценка', 'оценки', 'оценок']));
</script>

{#if average === undefined}
	<span class="mr-1 h-10 w-20 skeleton rounded-full" aria-hidden="true"></span>
{:else if average !== null}
	<a
		href="{page.url.pathname}/reviews"
		class="group mr-1 flex items-center gap-2 border-r border-base-content/15 pr-4"
		aria-label="Средняя оценка {text} из 10, {votes}"
	>
		<svg class="size-5 text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
			><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg
		>
		<span class="flex flex-col leading-none">
			<span class="text-2xl font-black tabular-nums group-hover:text-primary">{text}</span>
			<span class="mt-0.5 text-[0.7rem] text-base-content/50">{votes}</span>
		</span>
	</a>
{/if}
