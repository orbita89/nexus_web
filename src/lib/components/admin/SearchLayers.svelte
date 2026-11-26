<script lang="ts">
	import { FILTER_INFO, ORDER_INFO, describeFile } from '#lib/admin/searchMap.ts';
	import { formatBytes } from '#lib/admin/sidecar.ts';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaSearchLayout, SchemaSidecarView } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Слои единого индекса по живым данным: память слоя Б, готовые сортировки с первыми
	// записями, фильтры (где хранятся и самые частые значения), файлы на диске.
	let layout = $state<SchemaSearchLayout | null>(null);
	let memory = $state<SchemaSidecarView | null>(null);
	let error = $state('');
	let open = $state<string | null>(null);

	async function load() {
		try {
			[layout, memory] = await Promise.all([
				unwrap(api.catalog.GET('/api/v1/catalog/admin/search/layout')),
				unwrap(api.catalog.GET('/api/v1/catalog/admin/search/sidecar'))
			]);
			error = '';
		} catch (e) {
			error = errorMessage(e);
		}
	}
	$effect(() => {
		void load();
	});

	const num = (n: number) => n.toLocaleString('ru-RU');
	const bytesOf = (layer: string) =>
		layout?.files.filter((f) => f.layer === layer).reduce((s, f) => s + f.bytes, 0) ?? 0;
	const filters = $derived(
		layout
			? layout.filters.toSorted((a, b) => a.storage.localeCompare(b.storage) || b.values - a.values)
			: []
	);
</script>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

{#if layout && memory}
	<!-- Сводка по слоям -->
	<div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-box bg-base-200 p-4">
			<div class="text-xs text-base-content/60">Слой А · Tantivy на диске</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(bytesOf('A'))}</div>
			<div class="text-xs text-base-content/50">текст, карточки, фильтры по людям и студиям</div>
		</div>
		<div class="rounded-box bg-base-200 p-4">
			<div class="text-xs text-base-content/60">Слой Б · на диске</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(bytesOf('B'))}</div>
			<div class="text-xs text-base-content/50">сортировки, флаги, баллы, мелкие фильтры</div>
		</div>
		<div class="rounded-box bg-base-200 p-4">
			<div class="text-xs text-base-content/60">Слой Б · в памяти (куча)</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(memory.heap_bytes)}</div>
			<div class="text-xs text-base-content/50">
				ещё {formatBytes(memory.mapped_bytes)} читается из файла (mmap)
			</div>
		</div>
		<div class="rounded-box bg-base-200 p-4">
			<div class="text-xs text-base-content/60">Процесс целиком</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(memory.process.rss)}</div>
			<div class="text-xs text-base-content/50">
				куча {formatBytes(memory.process.anon)} · файлы {formatBytes(memory.process.file)}
			</div>
		</div>
	</div>

	<!-- Сортировки -->
	<div class="mb-6 rounded-box bg-base-200 p-4">
		<h3 class="mb-1 text-lg font-bold">Слой Б · сортировки</h3>
		<p class="mb-3 text-xs text-base-content/50">
			Каждая сортировка посчитана заранее: номера всех видимых сущностей по порядку. Страница списка
			— проход по порядку до 24 подходящих под фильтры. Ниже — первые пять во всём каталоге.
		</p>
		<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
			{#each layout.orders as o (o.name)}
				<div class="rounded-box bg-base-100 p-3">
					<div class="font-semibold">
						{ORDER_INFO[o.name]?.title ?? o.name}
						<code class="text-xs font-normal text-base-content/50">{o.name}</code>
					</div>
					<div class="mb-2 text-xs text-base-content/60">
						{ORDER_INFO[o.name]?.key ?? ''} · {num(o.len)} записей
					</div>
					<ol class="list-inside list-decimal text-sm">
						{#each o.head as h (h.ord)}<li class="truncate">{h.title}</li>{/each}
					</ol>
				</div>
			{/each}
		</div>
	</div>

	<!-- Фильтры -->
	<div class="mb-6 rounded-box bg-base-200 p-4">
		<h3 class="mb-1 text-lg font-bold">Фильтры (фасеты)</h3>
		<p class="mb-3 text-xs text-base-content/50">
			Мало значений и нужны почти каждому запросу — битовые карты в памяти (слой Б). Много значений
			(люди, студии, награды) — термы поля <code>facet</code> в Tantivy (слой А): в памяти ничего. Нажмите
			на строку — самые частые значения.
		</p>
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Фильтр</th>
						<th>Где хранится</th>
						<th class="text-right">Значений</th>
						<th class="text-right">В памяти</th>
						<th>Частые значения</th>
					</tr>
				</thead>
				<tbody>
					{#each filters as f (f.storage + f.group)}
						{@const id = f.storage + f.group}
						<tr
							class="cursor-pointer hover:bg-base-100"
							onclick={() => (open = open === id ? null : id)}
						>
							<td>
								{FILTER_INFO[f.group] ?? f.group}
								<code class="text-xs text-base-content/50">{f.group}</code>
							</td>
							<td>
								{#if f.storage === 'ram'}
									<span class="badge badge-sm badge-primary">Б · память</span>
								{:else}
									<span class="badge badge-sm badge-secondary">А · Tantivy</span>
								{/if}
							</td>
							<td class="text-right tabular-nums">{num(f.values)}</td>
							<td class="text-right tabular-nums">{f.bytes ? formatBytes(f.bytes) : '—'}</td>
							<td class="max-w-md truncate text-xs text-base-content/60">
								{f.top
									.slice(0, 4)
									.map((v) => v.value)
									.join(', ')}{f.top.length > 4 ? '…' : ''}
							</td>
						</tr>
						{#if open === id}
							<tr>
								<td colspan="5" class="bg-base-100">
									<div class="flex flex-wrap gap-1">
										{#each f.top as v (v.value)}
											<span class="badge badge-ghost badge-sm"
												>{v.value || '—'}
												<span class="text-base-content/50">{num(v.count)}</span></span
											>
										{/each}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Файлы -->
	<div class="mb-6 rounded-box bg-base-200 p-4">
		<h3 class="mb-1 text-lg font-bold">Файлы на диске</h3>
		<p class="mb-3 text-xs text-base-content/50">
			{num(layout.docs)} документов в {layout.segments} сегментах ·
			<code>{layout.dir}</code>
			{layout.readonly ? '· только чтение (прод)' : ''}
		</p>
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<tbody>
					{#each layout.files as f (f.name)}
						<tr>
							<td>
								<span
									class={['badge badge-sm', f.layer === 'A' ? 'badge-secondary' : 'badge-primary']}
									>{f.layer}</span
								>
							</td>
							<td class="font-mono text-xs">{f.name}</td>
							<td class="text-sm">{describeFile(f.name)}</td>
							<td class="text-xs">
								{f.access === 'mmap'
									? 'с диска (mmap)'
									: f.access === 'ram'
										? 'в память при открытии'
										: 'служебный'}
							</td>
							<td class="text-right tabular-nums">{formatBytes(f.bytes)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{:else if !error}
	<span class="loading loading-spinner"></span>
{/if}
