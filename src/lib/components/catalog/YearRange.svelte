<script lang="ts">
	import { untrack } from 'svelte';

	// Год в фильтрах — ползунок с двумя ручками и ряд быстрых промежутков над ним. Поле ввода
	// требовало знать формат («2000-2010»), а период выбирают на глаз: тут сразу видно и границы,
	// и то, что их две.
	//
	// Применяем по отпусканию ручки (onchange), а не на каждое движение: иначе каждый пиксель
	// протаскивания уходил бы в адрес и в запрос выдачи.
	let {
		year,
		yearFrom,
		yearTo,
		onapply
	}: {
		year?: number;
		yearFrom?: number;
		yearTo?: number;
		/** Границы периода; край, равный краю шкалы, приходит как есть — чистит его вызывающий. */
		onapply: (from: number, to: number) => void;
	} = $props();

	/** Шкала: от первых фильмов до текущего года. */
	const MIN = 1900;
	const MAX = new Date().getFullYear();

	// Ручки берут начальные значения из адреса один раз: панель открывается заново на каждый
	// клик по таблетке, так что untrack тут и есть нужное поведение — дальше ими двигает человек.
	let from = $state(untrack(() => yearFrom ?? year ?? MIN));
	let to = $state(untrack(() => yearTo ?? year ?? MAX));

	// Ручки не проходят друг сквозь друга: левая не заходит правее правой и наоборот.
	function moveFrom(value: number) {
		from = Math.min(value, to);
	}
	function moveTo(value: number) {
		to = Math.max(value, from);
	}

	const percent = (v: number) => ((v - MIN) / (MAX - MIN)) * 100;

	/** Быстрые промежутки: по ним выбирают чаще, чем тянут ручки. */
	const PRESETS: { title: string; from: number; to: number }[] = [
		{ title: 'Новинки', from: MAX - 2, to: MAX },
		{ title: '2010-е', from: 2010, to: 2019 },
		{ title: '2000-е', from: 2000, to: 2009 },
		{ title: '1990-е', from: 1990, to: 1999 },
		{ title: 'Классика', from: MIN, to: 1979 }
	];

	function preset(p: { from: number; to: number }) {
		from = p.from;
		to = p.to;
		onapply(from, to);
	}

	/** Год под курсором: клик по полосе ставит обе ручки в одну точку — ровно этот год. */
	function pickYear(e: MouseEvent & { currentTarget: HTMLButtonElement }) {
		// Enter на кнопке даёт клик без координат — годом это считать нельзя.
		if (!e.detail) return;
		const box = e.currentTarget.getBoundingClientRect();
		const ratio = (e.clientX - box.left) / box.width;
		const year = Math.round(MIN + ratio * (MAX - MIN));
		from = to = Math.min(Math.max(year, MIN), MAX);
		onapply(from, to);
	}

	/** Засечки по десятилетиям — ориентир на шкале длиной в век с лишним. */
	const DECADES = Array.from({ length: Math.floor((MAX - MIN) / 10) + 1 }, (_, i) => MIN + i * 10);

	/**
	 * Год, набранный руками. Мусор и выход за шкалу откатываем к тому, что было: пустое поле или
	 * «19» в фильтре — это молча пустая выдача.
	 */
	function type(field: HTMLInputElement, edge: 'from' | 'to') {
		const value = Number(field.value.trim());
		if (Number.isInteger(value) && value >= MIN && value <= MAX) {
			if (edge === 'from') moveFrom(value);
			else moveTo(value);
			onapply(from, to);
		}
		field.value = String(edge === 'from' ? from : to);
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-4">
		{#each PRESETS as p (p.title)}
			<button
				type="button"
				class="filter-tab"
				class:filter-tab-on={from === p.from && to === p.to}
				onclick={() => preset(p)}>{p.title}</button
			>
		{/each}
		<!-- Ровные годы набирают руками: тянуть ручку к «1984» по шкале в 126 лет мучительно. -->
		<span class="ml-auto flex items-center gap-2 text-sm text-base-content/50">
			<input
				class="year-field"
				aria-label="Год с"
				inputmode="numeric"
				maxlength="4"
				value={from}
				onchange={(e) => type(e.currentTarget, 'from')}
			/>
			—
			<input
				class="year-field"
				aria-label="Год по"
				inputmode="numeric"
				maxlength="4"
				value={to}
				onchange={(e) => type(e.currentTarget, 'to')}
			/>
		</span>
	</div>

	<!-- Две полупрозрачные шкалы друг поверх друга: саму полосу рисуем сами, у шкал остаются
	     только ручки (см. .year-range в layout.css). Сверху — место под подписи у ручек. -->
	<div class="year-range relative mt-6 h-6">
		<span class="year-range-track"></span>
		<!-- Засечки по десятилетиям: без них шкала — просто полоса, и непонятно, где ты. -->
		{#each DECADES as decade (decade)}
			<span class="year-range-tick" style="left: {percent(decade)}%"></span>
		{/each}
		<span class="year-range-fill" style="left: {percent(from)}%; right: {100 - percent(to)}%"
		></span>
		<!-- Клик по шкале — выбор одного года: тянуть две ручки в одну точку ради «1996» было
		     мучительно. Лежит под шкалами: у них сквозные клики, ловят только ручки. -->
		<button
			type="button"
			class="year-range-hit"
			tabindex="-1"
			aria-label="Выбрать один год"
			onclick={pickYear}
		></button>
		<span class="year-range-badge" style="left: {percent(from)}%">{from}</span>
		{#if from !== to}
			<span class="year-range-badge" style="left: {percent(to)}%">{to}</span>
		{/if}
		<input
			type="range"
			min={MIN}
			max={MAX}
			value={from}
			aria-label="Начало периода"
			oninput={(e) => moveFrom(e.currentTarget.valueAsNumber)}
			onchange={() => onapply(from, to)}
		/>
		<input
			type="range"
			min={MIN}
			max={MAX}
			value={to}
			aria-label="Конец периода"
			oninput={(e) => moveTo(e.currentTarget.valueAsNumber)}
			onchange={() => onapply(from, to)}
		/>
	</div>

	<div class="flex justify-between text-xs text-base-content/40">
		<span>{MIN}</span>
		<span>{MAX}</span>
	</div>
</div>
