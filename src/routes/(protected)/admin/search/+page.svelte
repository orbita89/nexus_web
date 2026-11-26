<script lang="ts">
	import { FIELD_INFO } from '#lib/admin/searchMap.ts';
	import SearchLayers from '#lib/components/admin/SearchLayers.svelte';
	import { formatBytes, formatDuration, operationTitle, share } from '#lib/admin/books-index.ts';
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaSearchIndexInfo } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Все поисковые индексы Tantivy: список из GET /admin/search/indexes, перестройка и слияние
	// сегментов выбранного индекса. Пока идёт операция, опрашиваем список раз в 3 секунды.
	const POLL_MS = 3000;

	let indexes = $state<SchemaSearchIndexInfo[] | null>(null);
	let selected = $state('works');
	let error = $state('');
	let notice = $state('');
	let busy = $state(false);
	/** Перестройка ждёт подтверждения: id индекса или «all». */
	let confirm = $state<string | null>(null);
	let force = $state(false);

	const current = $derived(indexes?.find((i) => i.id === selected) ?? null);
	const running = $derived(!!indexes?.some((i) => i.operation && i.operation.finished_at == null));

	/** Текущее время для живой длительности идущей операции (тикает раз в секунду). */
	let now = $state(Date.now());
	/** Запрос списка уже в пути — новый опрос не запускаем, чтобы не копить запросы к бэкенду. */
	let loading = false;

	async function load() {
		if (loading) return;
		loading = true;
		try {
			indexes = await unwrap(api.catalog.GET('/api/v1/catalog/admin/search/indexes'));
			error = '';
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void load();
	});

	$effect(() => {
		if (!running) return;
		const timer = setInterval(load, POLL_MS);
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(timer);
			clearInterval(tick);
		};
	});

	/** Сколько длится (или длилась) операция. */
	const elapsed = (op: { started_at: string; finished_at?: string | null }) =>
		formatDuration(
			Math.max(
				0,
				(op.finished_at ? new Date(op.finished_at).getTime() : now) -
					new Date(op.started_at).getTime()
			)
		);

	async function rebuild(id: string) {
		confirm = null;
		busy = true;
		notice = error = '';
		try {
			if (id === 'collections') {
				await unwrap(api.social.POST('/api/v1/social/admin/collections/index/rebuild'));
			} else {
				await unwrap(
					api.catalog.POST('/api/v1/catalog/admin/search/indexes/{id}/rebuild', {
						params: { path: { id }, query: { force } }
					})
				);
			}
			notice = id === 'all' ? 'Перестройка всех индексов запущена.' : 'Перестройка запущена.';
		} catch (e) {
			error = failure(e);
		} finally {
			busy = false;
			await load();
		}
	}

	async function merge(id: string) {
		busy = true;
		notice = error = '';
		try {
			await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/search/indexes/{id}/merge', {
					params: { path: { id } }
				})
			);
			notice = 'Слияние сегментов запущено.';
		} catch (e) {
			error = failure(e);
		} finally {
			busy = false;
			await load();
		}
	}

	// Только слой Б (фасеты, сортировки, популярность, ручные места) из БД — без Tantivy:
	// после «Обновить рейтинги» или правки популярности хватает этого, полная перестройка не нужна.
	async function reloadSidecar() {
		busy = true;
		notice = error = '';
		try {
			await unwrap(api.catalog.POST('/api/v1/catalog/admin/search/indexes/catalog/sidecar'));
			notice = 'Пересборка слоя Б запущена.';
		} catch (e) {
			error = failure(e);
		} finally {
			busy = false;
			await load();
		}
	}

	function failure(e: unknown) {
		if (e instanceof ApiError && e.status === 409) {
			return 'Уже идёт операция или перестройка. Дождитесь её окончания.';
		}
		return errorMessage(e);
	}

	const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('ru'));
	const date = (iso: string) =>
		new Date(iso).toLocaleString('ru', { dateStyle: 'medium', timeStyle: 'medium' });
	/** В индексе и в базе не поровну — индекс отстал. */
	const behind = (i: SchemaSearchIndexInfo) => i.db_docs != null && i.docs !== i.db_docs;
	const busyIndex = (i: SchemaSearchIndexInfo) => !!i.operation && i.operation.finished_at == null;
</script>

<svelte:head><title>Индексы — Админка — Кассандра</title></svelte:head>

<h1 class="mb-2 text-3xl font-black">Индексы</h1>
<p class="mb-6 max-w-3xl text-sm text-base-content/60">
	Весь поиск на сайте идёт через Tantivy. Выберите индекс, чтобы посмотреть его состояние,
	перестроить из базы или слить сегменты. Пока идёт перестройка, поиск читает старую версию.
</p>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}
{#if notice}<div role="status" class="mb-4 alert alert-soft alert-success">{notice}</div>{/if}

{#if !indexes}
	{#if !error}
		<p class="flex items-center gap-2 text-sm text-base-content/50" role="status">
			<span class="loading loading-sm loading-spinner"></span>Загружаем…
		</p>
	{/if}
{:else}
	<!-- Выбор индекса -->
	<div role="tablist" class="mb-4 flex flex-wrap gap-2">
		{#each indexes as i (i.id)}
			<button
				role="tab"
				aria-selected={selected === i.id}
				class="btn btn-sm {selected === i.id ? 'btn-primary' : ''}"
				onclick={() => (selected = i.id)}
			>
				{i.title}
				{#if behind(i)}<span class="badge badge-xs badge-warning" title="Индекс отстал"></span>{/if}
				{#if busyIndex(i)}<span class="loading loading-xs loading-spinner"></span>{/if}
			</button>
		{/each}
	</div>

	<!-- Все индексы сразу -->
	<div class="mb-6 flex flex-wrap items-center gap-2 rounded-box bg-base-200 p-3 text-sm">
		<span class="font-bold">Все индексы:</span>
		{#if confirm === 'all'}
			<span>Работы, люди и книги из базы: несколько минут. Начать?</span>
			<button class="btn btn-error btn-sm" onclick={() => rebuild('all')}>Да, перестроить</button>
			<button class="btn btn-ghost btn-sm" onclick={() => (confirm = null)}>Отмена</button>
		{:else}
			<button
				class="btn btn-primary btn-sm"
				disabled={running || busy}
				onclick={() => (confirm = 'all')}>Перестроить все</button
			>
			<span class="text-base-content/50">работы, люди, книги; коллекции — на их вкладке</span>
		{/if}
		<label class="ml-auto flex cursor-pointer items-center gap-2">
			<input type="checkbox" class="checkbox checkbox-xs" bind:checked={force} />
			<span title="Переключить, даже если новый индекс заметно меньше текущего">force</span>
		</label>
	</div>

	{#if current}
		{@const i = current}
		<section aria-label={i.title}>
			<h2 class="mb-1 text-2xl font-bold">{i.title}</h2>
			<p class="mb-4 text-sm text-base-content/60">{i.description}</p>

			{#if !i.enabled}
				<div role="alert" class="alert alert-soft alert-warning">
					Индекс выключен: не задан каталог (<code>SEARCH_INDEX_DIR</code>,
					<code>BOOKS_INDEX_DIR</code> или <code>ARCHIVE_DIR</code>).
				</div>
			{:else}
				<div class="stats mb-4 w-full stats-vertical bg-base-200 sm:stats-horizontal">
					<div class="stat">
						<div class="stat-title">В индексе</div>
						<div class="stat-value text-2xl">{num(i.docs)}</div>
						<div class="stat-desc">схема {i.schema_version ?? '—'}</div>
					</div>
					<div class="stat">
						<div class="stat-title">В базе</div>
						<div class="stat-value text-2xl">{num(i.db_docs)}</div>
						<div class="stat-desc">
							{i.db_docs == null ? 'не считается' : 'должно быть в индексе'}
						</div>
					</div>
					<div class="stat">
						<div class="stat-title">На диске</div>
						<div class="stat-value text-2xl">{formatBytes(i.disk_bytes)}</div>
						<div class="stat-desc">
							сегментов {num(i.segments)} · удалённых {num(i.deleted_docs)}
						</div>
					</div>
				</div>

				{#if behind(i)}
					<div role="alert" class="mb-4 alert alert-soft alert-warning">
						Индекс отстал: в базе {num(i.db_docs)}, в индексе {num(i.docs)}. Перестройте индекс.
					</div>
				{/if}

				<!-- Управление -->
				<div class="mb-6 flex flex-wrap items-center gap-2">
					{#if confirm === i.id}
						<span class="text-sm">Перестройка займёт время. Начать?</span>
						<button class="btn btn-error btn-sm" onclick={() => rebuild(i.id)}>
							Да, перестроить
						</button>
						<button class="btn btn-ghost btn-sm" onclick={() => (confirm = null)}>Отмена</button>
					{:else}
						{#if i.can_rebuild || i.rebuild_path}
							<button
								class="btn btn-primary btn-sm"
								disabled={running || busy}
								onclick={() => (confirm = i.id)}>Перестроить</button
							>
						{/if}
						{#if i.id === 'catalog' && i.can_rebuild}
							<button
								class="btn btn-sm"
								disabled={running || busy}
								title="Фасеты, сортировки и популярность из БД — без перестройки текста"
								onclick={reloadSidecar}>Пересобрать только слой Б</button
							>
						{/if}
						{#if i.can_merge}
							<button
								class="btn btn-sm"
								disabled={running || busy || (i.segments <= 1 && i.deleted_docs === 0)}
								title={i.segments <= 1 && i.deleted_docs === 0
									? 'Один сегмент и нет удалённых документов'
									: undefined}
								onclick={() => merge(i.id)}>Слить сегменты</button
							>
						{/if}
						{#if i.id === 'books'}
							<a class="btn btn-sm" href="/admin/books">Слой Б и ручной порядок →</a>
						{/if}
						{#if !i.can_rebuild && !i.rebuild_path}
							<span class="text-sm text-base-content/50">
								Перестройка этого индекса — командой <code>nexus archive build</code>.
							</span>
						{/if}
						{#if busy}<span class="loading loading-sm loading-spinner"></span>{/if}
					{/if}
				</div>

				{#if i.operation}
					{@const op = i.operation}
					<div class="mb-6 rounded-box bg-base-200 p-4 text-sm">
						<p class="flex flex-wrap items-center gap-2">
							<strong>Операция: {operationTitle(op.op)}</strong>
							{#if op.finished_at == null}
								<span class="badge badge-info"
									><span class="loading loading-xs loading-spinner"></span> идёт {elapsed(op)}</span
								>
							{:else if op.ok}
								<span class="badge badge-success">готово</span>
							{:else}
								<span class="badge badge-error">ошибка</span>
							{/if}
						</p>
						<p class="mt-1 text-base-content/60">
							Начало {date(op.started_at)} · {op.finished_at ? 'заняла' : 'идёт'}
							<strong>{elapsed(op)}</strong>
						</p>
						{#if op.progress && op.finished_at == null}
							{@const p = op.progress}
							<p class="mt-2">
								Шаг: <strong>{p.step}</strong>
								{#if p.total > 0}
									— {p.done.toLocaleString('ru-RU')} из {p.total.toLocaleString('ru-RU')}
									({Math.floor(share(p.done, p.total))}%)
								{:else}
									— подготовка…
								{/if}
							</p>
							{#if p.total > 0}
								<progress class="progress mt-1 w-full progress-info" value={p.done} max={p.total}
								></progress>
							{/if}
						{/if}
						{#if op.error}<p class="mt-1 text-error">{op.error}</p>{/if}
					</div>
				{/if}

				<!-- Из чего состоит индекс -->
				{#if i.fields.length}
					<div class="mb-6 rounded-box bg-base-200 p-4">
						<h3 class="mb-1 text-lg font-bold">Поля индекса</h3>
						<p class="mb-3 text-xs text-base-content/50">
							По данным Tantivy: {formatBytes(i.index_bytes)}; хранилище карточек (сжато целиком)
							{formatBytes(i.store_bytes)}.
						</p>
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Поле</th>
										<th class="text-right">Всего</th>
										<th>Доля</th>
										<th class="text-right">Словарь</th>
										<th class="text-right">Документы</th>
										<th class="text-right">Позиции</th>
										<th class="text-right">Колонки</th>
										<th class="text-right">Нормы</th>
									</tr>
								</thead>
								<tbody>
									{#each i.fields as f (f.field)}
										<tr>
											<td>
												<span class="font-mono text-xs">{f.field}</span>
												{#if FIELD_INFO[f.field]}
													<div class="max-w-xs text-xs text-base-content/50">
														{FIELD_INFO[f.field].what}
													</div>
												{/if}
											</td>
											<td class="text-right font-bold">{formatBytes(f.total)}</td>
											<td>
												<div class="flex items-center gap-2">
													<progress
														class="progress w-24 progress-primary"
														value={share(f.total, i.index_bytes)}
														max="100"
													></progress>
													<span class="text-xs text-base-content/50"
														>{Math.round(share(f.total, i.index_bytes))}%</span
													>
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
					</div>
				{/if}

				{#if i.id === 'catalog'}
					<SearchLayers />
				{/if}

				<!-- Поколения -->
				<div class="rounded-box bg-base-200 p-4">
					<h3 class="mb-3 text-lg font-bold">Каталог и поколения</h3>
					<p class="mb-3 font-mono text-xs text-base-content/60">{i.dir}</p>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr><th>Поколение</th><th class="text-right">Размер</th><th>Статус</th></tr>
							</thead>
							<tbody>
								{#each i.generations as g (g.name)}
									<tr>
										<td class="font-mono text-xs">{g.name}</td>
										<td class="text-right">{formatBytes(g.bytes)}</td>
										<td>
											{#if g.current}<span class="badge badge-sm badge-success">текущее</span
												>{:else}<span class="text-base-content/50">прежнее</span>{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</section>
	{/if}
{/if}
