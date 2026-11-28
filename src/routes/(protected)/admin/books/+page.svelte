<script lang="ts">
	import {
		canMerge,
		FACETS,
		formatBytes,
		formatDuration,
		FORMS,
		isBehind,
		isRunning,
		operationTitle,
		share
	} from '#lib/admin/books-index.ts';
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaBooksIndexStatus } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import StaticPagesPanel from '#lib/components/admin/StaticPagesPanel.svelte';

	// Книжный индекс: Tantivy (полнотекст) и слой Б (фасеты и порядки в памяти). Сводка — из
	// GET /admin/books/index; пока идёт операция, опрашиваем её раз в 3 секунды.
	const POLL_MS = 3000;

	let status = $state<SchemaBooksIndexStatus | null>(null);
	let error = $state('');
	let notice = $state('');
	/** Кнопка, по которой ушёл запрос. */
	let busy = $state<Action | null>(null);
	/** «Перестроить всё» ждёт подтверждения. */
	let confirmRebuild = $state(false);

	type Action = 'rebuild' | 'sidecar' | 'merge' | 'cache';

	const running = $derived(isRunning(status));
	const op = $derived(status?.operation);

	async function load() {
		try {
			status = await unwrap(api.catalog.GET('/api/v1/catalog/admin/books/index'));
			error = '';
		} catch (e) {
			error = errorMessage(e);
		}
	}

	$effect(() => {
		void load();
	});

	// Опрос только пока операция не закончилась; таймер снимается при смене running и уходе со страницы.
	$effect(() => {
		if (!running) return;
		const timer = setInterval(load, POLL_MS);
		return () => clearInterval(timer);
	});

	function request(action: Action) {
		switch (action) {
			case 'rebuild':
				return api.catalog.POST('/api/v1/catalog/admin/books/index/rebuild');
			case 'sidecar':
				return api.catalog.POST('/api/v1/catalog/admin/books/sidecar');
			case 'merge':
				return api.catalog.POST('/api/v1/catalog/admin/books/index/merge');
			case 'cache':
				return api.catalog.POST('/api/v1/catalog/admin/books/index/cache');
		}
	}

	const DONE: Record<Action, string> = {
		rebuild: 'Перестройка запущена.',
		sidecar: 'Пересборка слоя Б запущена.',
		merge: 'Слияние сегментов запущено.',
		cache: 'Кеш выдачи сброшен.'
	};

	async function run(action: Action) {
		confirmRebuild = false;
		busy = action;
		notice = error = '';
		try {
			await unwrap(request(action));
			notice = DONE[action];
		} catch (e) {
			if (e instanceof ApiError && e.status === 409) {
				await load();
				error = `Уже идёт операция${op ? ` «${operationTitle(op.op)}»` : ''}. Дождитесь её окончания.`;
			} else {
				error = errorMessage(e);
			}
		} finally {
			busy = null;
			await load();
		}
	}

	const date = (iso: string) =>
		new Date(iso).toLocaleString('ru', { dateStyle: 'medium', timeStyle: 'medium' });
	const num = (n: number) => n.toLocaleString('ru');
</script>

<svelte:head><title>Книжный индекс — Админка — Кассандра</title></svelte:head>

<h1 class="mb-2 text-3xl font-black">Книжный индекс</h1>
<p class="mb-6 max-w-3xl text-sm text-base-content/60">
	Книги ищет Tantivy, а фильтры и сортировки держит в памяти <strong>слой Б</strong>. Здесь видно,
	чем заняты индекс и диск, и можно перестроить индекс целиком или по частям.
</p>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}
{#if notice}<div role="status" class="mb-4 alert alert-soft alert-success">{notice}</div>{/if}

{#if !status}
	{#if !error}
		<p class="flex items-center gap-2 text-sm text-base-content/50" role="status">
			<span class="loading loading-sm loading-spinner"></span>Загружаем…
		</p>
	{/if}
{:else}
	{@const s = status}
	{@const t = s.text}
	{@const sc = s.sidecar}

	<!-- Сводка -->
	<div class="stats mb-4 w-full stats-vertical bg-base-200 sm:stats-horizontal">
		<div class="stat">
			<div class="stat-title">Книг в базе</div>
			<div class="stat-value text-2xl">{num(s.db_books)}</div>
			<div class="stat-desc">номеров выдано: {num(s.db_ords)}</div>
		</div>
		<div class="stat">
			<div class="stat-title">В Tantivy</div>
			<div class="stat-value text-2xl">{num(t.docs)}</div>
			<div class="stat-desc">схема {t.schema_version}</div>
		</div>
		<div class="stat">
			<div class="stat-title">В слое Б</div>
			<div class="stat-value text-2xl">{num(sc.books)}</div>
			<div class="stat-desc">поколение {sc.generation}</div>
		</div>
	</div>
	{#if isBehind(s)}
		<div role="alert" class="mb-4 alert alert-soft alert-warning">
			Индекс отстал: числа книг в базе, Tantivy и слое Б расходятся. Перестройте индекс.
		</div>
	{/if}

	<!-- Кнопки -->
	<div class="mb-6 flex flex-wrap items-center gap-2">
		{#if confirmRebuild}
			<span class="text-sm">Перестройка займёт несколько минут. Начать?</span>
			<button class="btn btn-error btn-sm" onclick={() => run('rebuild')}>Да, перестроить</button>
			<button class="btn btn-ghost btn-sm" onclick={() => (confirmRebuild = false)}>Отмена</button>
		{:else}
			<button
				class="btn btn-primary btn-sm"
				disabled={running || !!busy}
				onclick={() => (confirmRebuild = true)}>Перестроить всё</button
			>
			<button class="btn btn-sm" disabled={running || !!busy} onclick={() => run('sidecar')}
				>Пересобрать слой Б</button
			>
			<button
				class="btn btn-sm"
				disabled={running || !!busy || !canMerge(s)}
				title={canMerge(s) ? undefined : 'Один сегмент и нет удалённых документов'}
				onclick={() => run('merge')}>Слить сегменты</button
			>
			<button class="btn btn-sm" disabled={!!busy} onclick={() => run('cache')}>Сбросить кеш</button
			>
			{#if busy}<span class="loading loading-sm loading-spinner"></span>{/if}
		{/if}
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<!-- Сборки и операция -->
		<section class="rounded-box bg-base-200 p-4">
			<h2 class="mb-3 text-lg font-bold">Сборки и операция</h2>
			<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				<dt class="text-base-content/60">Индекс</dt>
				<dd>
					{#if s.last_index_build}
						{date(s.last_index_build.at)} · {formatDuration(s.last_index_build.took_ms)} · {num(
							s.last_index_build.books
						)} книг
					{:else}—{/if}
				</dd>
				<dt class="text-base-content/60">Слой Б</dt>
				<dd>
					{#if s.last_sidecar_build}
						{date(s.last_sidecar_build.at)} · {formatDuration(s.last_sidecar_build.took_ms)} · {num(
							s.last_sidecar_build.books
						)} книг
					{:else}—{/if}
				</dd>
			</dl>
			<p class="mt-1 text-xs text-base-content/50">Сборки в текущем процессе бэкенда.</p>
			{#if op}
				<div class="mt-3 border-t border-base-300 pt-3 text-sm">
					<p class="flex flex-wrap items-center gap-2">
						<strong>Операция: {operationTitle(op.op)}</strong>
						{#if running}
							<span class="badge badge-soft badge-info"
								><span class="loading loading-xs loading-spinner"></span>идёт</span
							>
						{:else if op.ok}
							<span class="badge badge-soft badge-success">готово</span>
						{:else}
							<span class="badge badge-soft badge-error">ошибка</span>
						{/if}
					</p>
					<p class="text-base-content/60">
						начата {date(op.started_at)}{#if op.finished_at}, длилась {formatDuration(
								new Date(op.finished_at).getTime() - new Date(op.started_at).getTime()
							)}{/if}
					</p>
					{#if op.error}
						<pre
							class="mt-2 rounded bg-error/10 p-2 text-xs whitespace-pre-wrap text-error">{op.error}</pre>
					{/if}
				</div>
			{/if}
		</section>

		<!-- Диск -->
		<section class="rounded-box bg-base-200 p-4">
			<h2 class="mb-3 text-lg font-bold">Диск</h2>
			<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
				<dt class="text-base-content/60">Индекс (по данным Tantivy)</dt>
				<dd class="text-right tabular-nums">{formatBytes(t.index_bytes)}</dd>
				<dt class="text-base-content/60">Хранилище карточек</dt>
				<dd class="text-right tabular-nums">{formatBytes(t.store_bytes)}</dd>
				<dt class="text-base-content/60">Все файлы папки</dt>
				<dd class="text-right tabular-nums">{formatBytes(t.disk_bytes)}</dd>
				<dt class="text-base-content/60">sidecar.bin</dt>
				<dd class="text-right tabular-nums">{formatBytes(t.sidecar_file_bytes)}</dd>
				<dt class="text-base-content/60">Сегментов</dt>
				<dd class="text-right tabular-nums">{num(t.segments)}</dd>
				<dt class="text-base-content/60">Удалённых документов</dt>
				<dd class="text-right tabular-nums">
					{num(t.deleted_docs)}{#if t.deletes_bytes}
						· {formatBytes(t.deletes_bytes)}{/if}
				</dd>
				<dt class="text-base-content/60">Кеш выдачи</dt>
				<dd class="text-right tabular-nums">
					{num(t.cache_entries)} ответов · {num(t.cache_ranked)} рядов
				</dd>
			</dl>
		</section>
	</div>

	<!-- Поля Tantivy -->
	<section class="mt-4 rounded-box bg-base-200 p-4">
		<h2 class="mb-3 text-lg font-bold">Поля Tantivy</h2>
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Поле</th>
						<th class="text-right">Всего</th>
						<th class="w-32">Доля</th>
						<th class="text-right">Словарь</th>
						<th class="text-right">Документы</th>
						<th class="text-right">Позиции</th>
						<th class="text-right">Колонки</th>
						<th class="text-right">Нормы</th>
					</tr>
				</thead>
				<tbody class="tabular-nums">
					{#each t.fields as f (f.field)}
						{@const pct = share(f.total, t.index_bytes)}
						<tr>
							<td class="font-mono">{f.field}</td>
							<td class="text-right font-semibold">{formatBytes(f.total)}</td>
							<td>
								<div class="flex items-center gap-2" title="{pct.toFixed(1)} %">
									<progress class="progress w-20 progress-primary" value={pct} max="100"></progress>
									<span class="text-xs text-base-content/50">{Math.round(pct)}%</span>
								</div>
							</td>
							<td class="text-right">{formatBytes(f.termdict)}</td>
							<td class="text-right">{formatBytes(f.postings)}</td>
							<td class="text-right">{formatBytes(f.positions)}</td>
							<td class="text-right">{formatBytes(f.fast)}</td>
							<td class="text-right">{formatBytes(f.fieldnorms)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Слой Б -->
	<section class="mt-4 rounded-box bg-base-200 p-4">
		<h2 class="mb-3 text-lg font-bold">Слой Б</h2>
		<div class="grid gap-6 lg:grid-cols-3">
			<div>
				<h3 class="mb-2 text-sm font-semibold text-base-content/70">Книги по видам</h3>
				<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
					{#each Object.entries(sc.forms) as [form, n] (form)}
						<dt class="text-base-content/60">{FORMS[form] ?? form}</dt>
						<dd class="text-right">{num(n)}</dd>
					{/each}
					<dt class="text-base-content/60">С обложкой</dt>
					<dd class="text-right">{num(sc.with_cover)}</dd>
				</dl>
			</div>
			<div>
				<h3 class="mb-2 text-sm font-semibold text-base-content/70">Фасеты</h3>
				<table class="table table-xs">
					<thead>
						<tr
							><th>Тип</th><th class="text-right">Значений</th><th class="text-right">Размер</th
							></tr
						>
					</thead>
					<tbody class="tabular-nums">
						{#each sc.facets as f (f.kind)}
							<tr>
								<td>{FACETS[f.kind] ?? f.kind}</td>
								<td class="text-right">{num(f.values)}</td>
								<td class="text-right">{formatBytes(f.bytes)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div>
				<h3 class="mb-2 text-sm font-semibold text-base-content/70">Память</h3>
				<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
					<dt class="text-base-content/60">Метаданные сортировки</dt>
					<dd class="text-right">{formatBytes(sc.meta_bytes)}</dd>
					<dt class="text-base-content/60">Готовые порядки</dt>
					<dd class="text-right">{formatBytes(sc.orders_bytes)}</dd>
					<dt class="text-base-content/60">Фасеты</dt>
					<dd class="text-right">{formatBytes(sc.facets_bytes)}</dd>
					<dt class="font-semibold">Всего</dt>
					<dd class="text-right font-semibold">{formatBytes(sc.total_bytes)}</dd>
					<dt class="text-base-content/60">Слотов (с дырами)</dt>
					<dd class="text-right">{num(sc.slots)}</dd>
					<dt class="text-base-content/60">Ручных мест</dt>
					<dd class="text-right">{num(sc.manual_ranks)}</dd>
				</dl>
			</div>
		</div>
	</section>
{/if}

<div class="mt-4">
	<StaticPagesPanel kind="book" />
</div>
