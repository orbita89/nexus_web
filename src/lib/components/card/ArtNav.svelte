<script lang="ts">
	import { goto } from '$app/navigation';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { forgetRow, markSeen, readRow, recentlySeen } from '#lib/catalog/row.ts';
	import { neighbours, searchPage } from '#lib/catalog/search.ts';
	import { browserApi, liveQuery } from '#lib/social/card-live.svelte.ts';

	// Листание картин прямо на карточке. Ряд — тот список, из которого сюда пришли: соседей в нём
	// считает бэкенд (GET /entities/{slug}/neighbors с теми же фильтрами, что были у списка).
	// Ряд кончился или его нет (прямой заход) — идут похожие, кончились и они — случайная картина:
	// «следующая» есть всегда. Адреса чистые: параметры ряда живут в sessionStorage (row.ts).
	let { slug }: { slug: string } = $props();

	const SIMILAR = 12;

	// Эту карточку видели: следующая постарается её не предлагать.
	$effect(() => markSeen(slug));

	/** Соседи по ряду: без ряда и на его краях — пусто. */
	const around = liveQuery(
		() => slug,
		async (slug) => {
			const row = readRow();
			if (!row) return null;
			const found = await neighbours(browserApi(), slug, row.filters, {
				kind: row.kind,
				sort: row.sort
			});
			// Работы в ряду нет (ушли в похожие, сменился фильтр) — ряд больше не нужен.
			if (!found.prev && !found.next) forgetRow();
			return found;
		}
	);
	const prev = $derived(around.current?.data?.prev ?? null);
	const next = $derived(around.current?.data?.next ?? null);
	/** Ряд ответил и соседа в нём нет — дальше ведут похожие, а за ними случайная. */
	const beyondRow = $derived(!!around.current && !next);

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
	// Не первая похожая, а случайная из подбора и мимо недавно показанных: иначе две картины
	// начинают указывать друг на друга и листание ходит по кругу.
	const nextSimilar = $derived.by(() => {
		const pool = similar.current?.data ?? [];
		const seen = new Set(recentlySeen());
		const fresh = pool.filter((item) => !seen.has(item.slug));
		const choose = fresh.length ? fresh : pool;
		return choose.length ? choose[Math.floor(Math.random() * choose.length)] : null;
	});

	// Подбор пришёл пустым — берём случайную картину каталога (sort=random на стороне бэкенда).
	const random = liveQuery(
		() => (beyondRow && similar.current && !nextSimilar ? slug : null),
		async (slug): Promise<SchemaEntitySummary | null> => {
			if (!slug) return null;
			const found = await searchPage(
				browserApi(),
				{},
				{ kind: 'painting', sort: 'random', limit: 1, offset: 0 }
			);
			const pick = found.items[0];
			return pick && pick.slug !== slug ? pick : null;
		}
	);

	const prevHref = $derived(prev ? entityHref(prev) : null);
	const beyond = $derived(nextSimilar ?? random.current?.data ?? null);
	const nextHref = $derived(
		next ? entityHref(next) : beyondRow && beyond ? entityHref(beyond) : null
	);

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

<!-- Отступа у полосы нет: она стоит в общем ряду под холстом, рядом с «Во весь экран». -->
<nav class="flex items-center gap-2" aria-label="Листание картин">
	{#if prevHref}
		<a href={prevHref} class="btn btn-circle btn-sm" aria-label="Предыдущая картина">‹</a>
	{:else}
		<span class="btn btn-disabled btn-circle btn-sm" aria-hidden="true">‹</span>
	{/if}
	{#if nextHref}
		<a href={nextHref} class="btn rounded-full btn-sm" aria-label="Следующая картина">Следующая ›</a
		>
	{:else}
		<span class="btn btn-disabled rounded-full btn-sm" aria-hidden="true">Следующая ›</span>
	{/if}
</nav>
