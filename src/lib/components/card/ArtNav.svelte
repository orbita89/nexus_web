<script lang="ts">
	import { goto } from '$app/navigation';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { extendRow, neighbours, readRow, type Row } from '#lib/catalog/row.ts';
	import { searchPage } from '#lib/catalog/search.ts';
	import { browserApi, liveQuery } from '#lib/social/card-live.svelte.ts';

	// Листание картин прямо на карточке. Ряд — тот список, из которого сюда пришли (row.ts): со
	// страницы художника листаем его работы, с тега — работы тега, из раздела или поиска — ту же
	// выдачу в том же порядке. Ряд кончился или его нет (прямой заход) — идут «Похожие».
	// Адреса чистые: ряд живёт в sessionStorage, в ссылки ничего не дописывается.
	let { slug }: { slug: string } = $props();

	/** Сколько дочитывать за раз, когда показанные слоты ряда кончились. */
	const CHUNK = 24;
	const SIMILAR = 12;

	/** Ряд на момент открытия карточки; дочитанные порции дописываются сюда же. */
	let row = $state<Row | null>(null);
	let loadingMore = $state(false);
	/** Человек нажал «Похожие» — ряд дальше не нужен. */
	let dropped = $state(false);

	const inRow = $derived(!dropped && row ? neighbours(row, slug) : null);

	// Ряд читаем только в браузере: на сервере хранилища нет, и разметка должна совпасть.
	$effect(() => {
		row = readRow(slug);
		dropped = false;
	});

	// «Похожие» нужны и как запасной ряд, и как продолжение после последней работы ряда.
	const similar = liveQuery(
		() => slug,
		async (slug) => {
			const found = await unwrap(
				browserApi().catalog.GET('/api/v1/catalog/entities/{slug}/similar', {
					params: { path: { slug }, query: { limit: SIMILAR } }
				})
			);
			return found.items.filter((item) => item.kind === 'painting');
		}
	);
	const nextSimilar = $derived(similar.current?.data?.[0] ?? null);

	const prevHref = $derived(inRow?.prev ? `/paintings/${inRow.prev}` : null);
	const nextHref = $derived(
		inRow?.next
			? `/paintings/${inRow.next}`
			: !inRow?.canExtend && nextSimilar
				? entityHref(nextSimilar)
				: null
	);
	/** Ряд закончился, дальше — подбор: об этом честно пишем, чтобы переход не был неожиданным. */
	const leaving = $derived(!!inRow && !inRow.next && !inRow.canExtend && !!nextSimilar);

	// Показанные слоты ряда кончились, но в нём есть ещё — дочитываем ту же выдачу теми же
	// фильтрами, что и список, из которого пришли.
	$effect(() => {
		const current = row;
		if (!current?.more || !inRow?.canExtend || inRow.next || loadingMore) return;
		loadingMore = true;
		void searchPage(browserApi(), current.more.filters, {
			kind: current.more.kind,
			sort: current.more.sort,
			limit: CHUNK,
			offset: current.slugs.length
		})
			.then((page) => {
				row = extendRow(
					current,
					page.items.map((item: SchemaEntitySummary) => item.slug)
				);
			})
			.catch(() => {
				// Дочитать не вышло — ряд считаем законченным, дальше пойдут «Похожие».
				row = { ...current, total: current.slugs.length };
			})
			.finally(() => (loadingMore = false));
	});

	function go(href: string | null) {
		if (href) void goto(href);
	}
</script>

<!-- Стрелки клавиатуры листают, пока фокус не в поле ввода. -->
<svelte:window
	onkeydown={(e) => {
		if (e.target !== document.body || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === 'ArrowLeft') go(prevHref);
		if (e.key === 'ArrowRight') go(nextHref);
	}}
/>

<nav class="mt-4 flex flex-wrap items-center justify-center gap-3" aria-label="Листание картин">
	{#if inRow && row}
		<div class="flex items-center gap-2 text-sm">
			<span class="font-medium">{row.label}</span>
			<span class="text-base-content/40">{inRow.at + 1} из {row.total}</span>
			<button
				type="button"
				class="link text-xs text-base-content/50 link-hover"
				onclick={() => (dropped = true)}>похожие</button
			>
		</div>
	{:else if nextSimilar}
		<span class="text-sm text-base-content/50">Похожие картины</span>
	{/if}

	<div class="flex items-center gap-2">
		{#if prevHref}
			<a href={prevHref} class="btn btn-circle btn-sm" aria-label="Предыдущая картина">‹</a>
		{:else}
			<span class="btn btn-disabled btn-circle btn-sm" aria-hidden="true">‹</span>
		{/if}
		{#if nextHref}
			<a href={nextHref} class="btn gap-1 btn-sm" aria-label="Следующая картина">
				{leaving ? 'Дальше похожие' : 'Следующая'} ›
			</a>
		{:else}
			<span class="btn btn-disabled btn-sm" aria-hidden="true">
				{loadingMore ? 'Загружаем…' : 'Следующая ›'}
			</span>
		{/if}
	</div>
</nav>
