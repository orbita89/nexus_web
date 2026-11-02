<script lang="ts">
	import { goto } from '$app/navigation';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import {
		extendRow,
		markSeen,
		neighbours,
		readRow,
		recentlySeen,
		type Row
	} from '#lib/catalog/row.ts';
	import { searchPage } from '#lib/catalog/search.ts';
	import { browserApi, liveQuery } from '#lib/social/card-live.svelte.ts';

	// Листание картин прямо на карточке. Ряд — тот список, из которого сюда пришли (row.ts): со
	// страницы художника листаем его работы, с тега — работы тега, из раздела или поиска — ту же
	// выдачу в том же порядке. Кончился ряд или его нет (прямой заход) — идут похожие, а когда и
	// они кончились — случайная картина: «следующая» есть всегда.
	// В интерфейсе только стрелки: подпись ряда и счётчик «2 из 3» ничего не решают и шумят.
	// Адреса чистые: ряд живёт в sessionStorage, в ссылки ничего не дописывается.
	let { slug }: { slug: string } = $props();

	/** Сколько дочитывать за раз, когда показанные слоты ряда кончились. */
	const CHUNK = 24;
	const SIMILAR = 12;

	// Ряд этой карточки; на сервере хранилища нет — там он пустой, в браузере читается из
	// sessionStorage. Переприсваиваем, когда дочитали следующую порцию.
	let row: Row | null = $derived(readRow(slug));
	let loadingMore = $state(false);

	const inRow = $derived(row ? neighbours(row, slug) : null);
	/** Ряда нет или он кончился — дальше ведёт подбор, а за ним случайная картина. */
	const beyondRow = $derived(!inRow?.next && !inRow?.canExtend);

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
	// За рядом ведём не к первой похожей, а к случайной из неё и мимо недавно показанных: иначе
	// две картины начинают указывать друг на друга и листание ходит по кругу.
	const nextSimilar = $derived.by(() => {
		const pool = similar.current?.data ?? [];
		const seen = new Set(recentlySeen());
		const fresh = pool.filter((item) => !seen.has(item.slug));
		const choose = fresh.length ? fresh : pool;
		return choose.length ? choose[Math.floor(Math.random() * choose.length)] : null;
	});

	// Эту карточку видели: следующая постарается её не предлагать.
	$effect(() => markSeen(slug));

	/** Случайная картина каталога: нужна, когда и ряд, и подбор кончились. */
	async function anyPainting(not: string): Promise<SchemaEntitySummary | null> {
		const api = browserApi();
		const pick = (offset: number) =>
			searchPage(api, {}, { kind: 'painting', sort: 'title', limit: 1, offset });
		const total = (await pick(0)).total;
		if (!total) return null;
		const seen = new Set([not, ...recentlySeen()]);
		let fallback: SchemaEntitySummary | null = null;
		for (let tries = 0; tries < 4; tries++) {
			const found = (await pick(Math.floor(Math.random() * total))).items[0];
			if (!found) continue;
			if (!seen.has(found.slug)) return found;
			if (found.slug !== not) fallback = found;
		}
		return fallback;
	}

	// Подбор пришёл пустым — берём случайную. Запрос уходит только в этом случае.
	const random = liveQuery(
		() => (beyondRow && similar.current && !nextSimilar ? slug : null),
		async (slug) => (slug ? await anyPainting(slug) : null)
	);

	const prevHref = $derived(inRow?.prev ? `/paintings/${inRow.prev}` : null);
	const beyond = $derived(nextSimilar ?? random.current?.data ?? null);
	const nextHref = $derived(
		inRow?.next ? `/paintings/${inRow.next}` : beyondRow && beyond ? entityHref(beyond) : null
	);

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
				// Дочитать не вышло — считаем ряд законченным, дальше пойдут подбор и случайные.
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

<nav class="mt-4 flex items-center justify-center gap-2" aria-label="Листание картин">
	{#if prevHref}
		<a href={prevHref} class="btn btn-circle btn-sm" aria-label="Предыдущая картина">‹</a>
	{:else}
		<span class="btn btn-disabled btn-circle btn-sm" aria-hidden="true">‹</span>
	{/if}
	{#if nextHref}
		<a href={nextHref} class="btn btn-sm" aria-label="Следующая картина">Следующая ›</a>
	{:else}
		<span class="btn btn-disabled btn-sm" aria-hidden="true">Следующая ›</span>
	{/if}
</nav>
