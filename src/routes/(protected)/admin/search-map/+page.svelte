<script lang="ts">
	import { formatBytes } from '#lib/admin/sidecar.ts';
	import { TIERS, formatMicros, pct } from '#lib/admin/searchMap.ts';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaExplainView, SchemaSearchLayout } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import SearchLayers from '#lib/components/admin/SearchLayers.svelte';
	import SidecarMemory from '#lib/components/admin/SidecarMemory.svelte';

	// Как устроен поиск сейчас: схема, файлы и поля, сортировки, фильтры, разбор запроса, память.
	const TABS = [
		['scheme', 'Схема'],
		['files', 'Слои: сортировки, фильтры, файлы'],
		['explain', 'Проверить запрос'],
		['memory', 'Память и запись']
	] as const;
	type Tab = (typeof TABS)[number][0];
	let tab = $state<Tab>('scheme');

	let layout = $state<SchemaSearchLayout | null>(null);
	let error = $state('');

	async function load() {
		try {
			layout = await unwrap(api.catalog.GET('/api/v1/catalog/admin/search/layout'));
			error = '';
		} catch (e) {
			error = errorMessage(e);
		}
	}
	$effect(() => {
		void load();
	});

	const num = (n: number) => n.toLocaleString('ru-RU');
	const layerBytes = (l: string) =>
		layout?.files.filter((f) => f.layer === l).reduce((s, f) => s + f.bytes, 0) ?? 0;

	// Разбор запроса.
	let form = $state({ q: 'мастер', kind: '', sort: '', person: '', studio: '', limit: 20 });
	let explain = $state<SchemaExplainView | null>(null);
	let explaining = $state(false);
	let explainError = $state('');

	async function runExplain(e?: SubmitEvent) {
		e?.preventDefault();
		explaining = true;
		explainError = '';
		try {
			const query: Record<string, string | number> = { limit: form.limit };
			for (const key of ['q', 'kind', 'sort', 'person', 'studio'] as const) {
				if (form[key]) query[key] = form[key];
			}
			explain = await unwrap(
				api.catalog.GET('/api/v1/catalog/admin/search/explain', {
					params: { query: query as never }
				})
			);
		} catch (err) {
			explainError = errorMessage(err);
		} finally {
			explaining = false;
		}
	}
	const explainTotal = $derived(explain?.steps.reduce((s, x) => s + x.micros, 0) ?? 0);
</script>

<svelte:head><title>Устройство поиска — Админка — Кассандра</title></svelte:head>

<h1 class="mb-2 text-3xl font-black">Устройство поиска</h1>
<p class="mb-4 max-w-3xl text-sm text-base-content/60">
	Как сейчас хранятся индексы, как сортируется и фильтруется каталог и как поиск отвечает на
	конкретный запрос — по живым данным.
</p>

<div role="tablist" class="tabs tabs-box mb-6 w-fit flex-wrap">
	{#each TABS as [id, title] (id)}
		<button
			role="tab"
			class={['tab', { 'tab-active': tab === id }]}
			aria-selected={tab === id}
			onclick={() => (tab = id)}>{title}</button
		>
	{/each}
</div>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

{#if tab === 'memory'}
	<SidecarMemory />
{:else if tab === 'explain'}
	<form class="mb-4 flex max-w-4xl flex-wrap items-end gap-2" onsubmit={runExplain}>
		<label class="flex flex-col text-xs"
			>Запрос<input class="input-bordered input w-48 input-sm" bind:value={form.q} /></label
		>
		<label class="flex flex-col text-xs"
			>Вид<select class="select-bordered select select-sm" bind:value={form.kind}>
				<option value="">все</option>
				{#each ['movie', 'series', 'book', 'game', 'painting'] as k (k)}<option>{k}</option>{/each}
			</select></label
		>
		<label class="flex flex-col text-xs"
			>Сортировка<select class="select-bordered select select-sm" bind:value={form.sort}>
				<option value="">по релевантности</option>
				{#each ['recommended', 'trending', 'top_rated', 'new', 'soon', 'popular', 'rating', 'awarded', 'title'] as s (s)}<option
						>{s}</option
					>{/each}
			</select></label
		>
		<label class="flex flex-col text-xs"
			>Человек (slug)<input
				class="input-bordered input w-40 input-sm"
				bind:value={form.person}
			/></label
		>
		<label class="flex flex-col text-xs"
			>Студия<input class="input-bordered input w-32 input-sm" bind:value={form.studio} /></label
		>
		<button class="btn btn-primary btn-sm" disabled={explaining}>
			{#if explaining}<span class="loading loading-xs loading-spinner"></span>{/if}Разобрать
		</button>
	</form>
	{#if explainError}<Alert>{explainError}</Alert>{/if}
	{#if explain}
		<section class="mb-6 max-w-4xl">
			<h2 class="mb-2 text-lg font-semibold">
				Шаги <span class="text-sm font-normal text-base-content/60"
					>всего {formatMicros(explainTotal)} · найдено {num(explain.total)}{explain.approximate
						? ' · с опечаткой'
						: ''}</span
				>
			</h2>
			<ol class="flex flex-col gap-1">
				{#each explain.steps as s, i (i)}
					<li class="flex items-center gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
						<span class="badge badge-sm">{i + 1}</span>
						<span class="flex-1">{s.name}</span>
						<span class="tabular-nums">{num(s.count)}</span>
						<span class="w-20 text-right text-xs text-base-content/60 tabular-nums"
							>{formatMicros(s.micros)}</span
						>
					</li>
				{/each}
			</ol>
			{#if explain.facet_terms.length}
				<p class="mt-2 text-xs text-base-content/60">
					Термы фильтров слоя А: {#each explain.facet_terms as t (t)}<code class="mx-1">{t}</code
						>{/each}
				</p>
			{/if}
		</section>
		<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>#</th>
						<th>Название</th>
						{#if explain.relevance}
							<th>Уровень</th>
							<th class="min-w-56">Текст · популярность → итог</th>
							<th class="text-right">BM25</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each explain.items as it (it.ord)}
						<tr>
							<td class="tabular-nums">{it.position + 1}</td>
							<td
								><a class="link-hover" href="/{it.kind}/{it.slug}" target="_blank">{it.title}</a>
								<span class="badge badge-ghost badge-xs">{it.kind}</span></td
							>
							{#if it.detail}
								{@const d = it.detail}
								<td class="text-xs"
									>{d.tier} · {TIERS[d.tier]}{d.manual_rank
										? ` (место ${d.manual_rank})`
										: ''}{d.exact ? ' · точное' : ''}</td
								>
								<td>
									<div class="flex items-center gap-2 text-xs tabular-nums">
										<div class="flex h-2 w-40 overflow-hidden rounded-full bg-base-300">
											<span class="bg-primary" style:width="{pct((1 - d.weight) * d.text)}%"></span>
											<span class="bg-secondary" style:width="{pct(d.weight * d.popularity)}%"
											></span>
										</div>
										<span
											title="(1 − {d.weight.toFixed(2)}) × {d.text.toFixed(2)} + {d.weight.toFixed(
												2
											)} × {d.popularity.toFixed(2)}">{d.total.toFixed(3)}</span
										>
									</div>
								</td>
								<td class="text-right text-xs tabular-nums">{d.bm25.toFixed(2)}</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
			{#if explain.relevance}
				<p class="p-2 text-xs text-base-content/60">
					Сначала уровень (меньше — выше), внутри уровня — итог. Полоса: <span class="text-primary"
						>текст</span
					>
					(√ доли лучшей оценки BM25, у точного названия 1) и
					<span class="text-secondary">популярность</span> (балл / лучший балл вида среди найденных),
					с весом вида со страницы «Сортировка».
				</p>
			{/if}
		</div>
	{/if}
{:else if layout}
	{#if tab === 'scheme'}
		<div class="grid max-w-5xl gap-4 md:grid-cols-2">
			<section class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<h2 class="mb-1 text-lg font-semibold">
					Слой А — Tantivy <span class="text-sm font-normal text-base-content/60"
						>{formatBytes(layerBytes('A'))} на диске</span
					>
				</h2>
				<p class="mb-2 text-sm text-base-content/70">
					Текстовый индекс: {num(layout.docs)} документов в {layout.segments} сегментах. Ищет слова в
					названиях, именах и сериях, фильтрует по людям, студиям, издателям, музеям и наградам, хранит
					готовые карточки выдачи ({formatBytes(layout.store_bytes)}). Читается с диска страницами
					(mmap) — в куче его нет.
				</p>
				<p class="text-xs text-base-content/50">Вкладка «Файлы и поля» — из чего он состоит.</p>
			</section>
			<section class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<h2 class="mb-1 text-lg font-semibold">
					Слой Б — фасеты и сортировки <span class="text-sm font-normal text-base-content/60"
						>{formatBytes(layerBytes('B'))} на диске</span
					>
				</h2>
				<p class="mb-2 text-sm text-base-content/70">
					Всё, что нужно, чтобы фильтровать и сортировать без перебора: у каждой сущности номер, по
					номеру — флаги, балл, дата и место в каждом из 8 готовых порядков. Порядки и массивы лежат
					в файле <code>.cols</code> и читаются с диска (mmap), мелкие фильтры (вид, тег, страна, год…)
					— битовые карты в памяти, несколько мегабайт.
				</p>
				<p class="text-xs text-base-content/50">
					«Слой Б» — это роль данных, а не место: раньше он целиком жил в куче, теперь почти весь в
					файле.
				</p>
			</section>
			<section class="rounded-box p-4 ring-1 ring-base-300 md:col-span-2">
				<h2 class="mb-3 text-lg font-semibold">Как отвечает запрос</h2>
				<ol class="flex flex-col gap-2 text-sm">
					<li>
						<span class="badge badge-sm badge-primary">Б</span> Фильтры из памяти: пересечение битовых
						карт (вид, тег, страна, год, обложка) — микросекунды.
					</li>
					<li>
						<span class="badge badge-sm badge-secondary">А</span> Фильтры по человеку, студии,
						издателю, музею, награде — термы поля <code>facet</code> в Tantivy: короткий список номеров
						с диска.
					</li>
					<li>
						<span class="badge badge-sm badge-secondary">А</span> Есть текст — Tantivy находит совпадения
						среди отфильтрованных (все слова; пусто — с опечаткой), отдельно точное название и совпадения
						в названии.
					</li>
					<li>
						<span class="badge badge-sm badge-primary">Б</span> Порядок: по релевантности — уровень, затем
						текст + популярность вида; любая другая сортировка — проход по готовому порядку слоя Б до
						нужной страницы.
					</li>
					<li>
						<span class="badge badge-sm badge-secondary">А</span> Карточки страницы — из хранилища
						Tantivy (поле <code>card</code>), без базы данных. Ответ кэшируется до смены индекса.
					</li>
				</ol>
				<p class="mt-3 text-xs text-base-content/50">
					{layout.readonly
						? 'Этот сервер только читает индекс (SEARCH_INDEX_READONLY): индекс собирается локально и выкладывается файлами.'
						: 'Этот сервер может перестраивать индекс (локальная сборка). На проде включается SEARCH_INDEX_READONLY.'}
					Каталог: <code>{layout.dir}</code>
				</p>
			</section>
		</div>
	{:else if tab === 'files'}
		<SearchLayers />
	{/if}
{:else if !error}
	<span class="loading loading-spinner"></span>
{/if}
