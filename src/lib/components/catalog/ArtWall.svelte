<script lang="ts" generics="T">
	import { untrack, type Snippet } from 'svelte';

	// Стена картин: холсты разной высоты в несколько колонок. CSS-колонки (`columns-*`) для этого
	// не годятся — дописав порцию, браузер перекладывает всю стену заново, и уже просмотренные
	// картины прыгают на другие места. Поэтому колонки собираем сами: каждая новая картина уходит
	// в самую короткую колонку и больше не двигается. Перестроение — только при смене ширины окна
	// (поменялось число колонок) или когда пришла другая выдача.
	let {
		items,
		key,
		tile
	}: {
		items: T[];
		/** Устойчивый ключ элемента (id): по нему же находим уже разложенные. */
		key: (item: T) => string;
		/** Разметка одной карточки. */
		tile: Snippet<[T]>;
	} = $props();

	/** Ширины, на которых меняется число колонок, — те же, что у сетки каталога. */
	const BREAKPOINTS = [
		{ from: 1024, cols: 4 },
		{ from: 640, cols: 3 },
		{ from: 0, cols: 2 }
	];
	/** До замера (сервер, первый кадр) — как на десктопе. */
	const SSR_COLS = 4;

	let cols = $state(SSR_COLS);
	// Первая раскладка — сразу: иначе на сервере стена отрендерится пустой. Дальше её ведёт $effect.
	let columns = $state<T[][]>(untrack(() => spread(items, SSR_COLS)));
	let host = $state<HTMLDivElement | undefined>();
	let boxes = $state<(HTMLElement | undefined)[]>([]);

	/** Раскладка без замеров: по кругу. Ею рисуем на сервере и начинаем на клиенте. */
	function spread(list: T[], n: number): T[][] {
		const out: T[][] = Array.from({ length: n }, () => []);
		list.forEach((item, i) => out[i % n].push(item));
		return out;
	}

	/** Высота по умолчанию, пока мерить нечего: примерная высота карточки. */
	const GUESS = 320;

	/** Высоты колонок на сейчас: замер со страницы, а до него — по числу карточек. */
	function heights(current: T[][]): number[] {
		return current.map((column, i) => boxes[i]?.offsetHeight ?? column.length * GUESS);
	}

	// Новые картины дописываем, остальное оставляем как есть. Другая выдача (первая картина
	// сменилась) или другое число колонок — раскладываем заново.
	$effect(() => {
		const shown = new Set(columns.flat().map(key));
		const same =
			items.length >= shown.size && items.slice(0, shown.size).every((i) => shown.has(key(i)));
		if (columns.length !== cols || !same) {
			columns = spread(items, cols);
			return;
		}
		const fresh = items.filter((i) => !shown.has(key(i)));
		if (!fresh.length) return;
		const next = columns.map((c) => [...c]);
		// Внутри одной порции страница ещё не перерисована, поэтому к высоте колонки прибавляем
		// среднюю высоту уже показанной карточки: порция ложится ровно, а не по кругу.
		const tall = heights(next);
		const placed = next.reduce((n, c) => n + c.length, 0);
		const average = placed ? tall.reduce((a, b) => a + b, 0) / placed : GUESS;
		for (const item of fresh) {
			const i = tall.indexOf(Math.min(...tall));
			next[i].push(item);
			tall[i] += average;
		}
		columns = next;
	});

	// Число колонок — по ширине самой стены, а не окна: справа ещё панель чата.
	$effect(() => {
		if (!host) return;
		const observer = new ResizeObserver(([entry]) => {
			const width = entry.contentRect.width;
			cols = BREAKPOINTS.find((b) => width >= b.from)?.cols ?? 2;
		});
		observer.observe(host);
		return () => observer.disconnect();
	});
</script>

<div class="flex items-start gap-4" bind:this={host}>
	{#each columns as column, i (i)}
		<ul class="flex w-full min-w-0 flex-col gap-6" bind:this={boxes[i]}>
			{#each column as item (key(item))}
				<li>{@render tile(item)}</li>
			{/each}
		</ul>
	{/each}
</div>
