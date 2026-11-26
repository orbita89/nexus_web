<script lang="ts">
	import { describePart, formatBytes, groupParts } from '#lib/admin/sidecar.ts';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaSidecarItem, SchemaSidecarView } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Слой Б — всё, что поиск держит в оперативной памяти помимо текстового индекса Tantivy
	// (тот читается с диска): плоские массивы по номерам сущностей, готовые порядки сортировок
	// и битовые карты фильтров.
	let view = $state<SchemaSidecarView | null>(null);
	let error = $state('');
	let slug = $state('');
	let item = $state<SchemaSidecarItem | null>(null);
	let itemError = $state('');
	let looking = $state(false);

	async function load() {
		try {
			view = await unwrap(api.catalog.GET('/api/v1/catalog/admin/search/sidecar'));
			error = '';
		} catch (e) {
			error = errorMessage(e);
		}
	}

	$effect(() => {
		void load();
	});

	async function lookup(e: SubmitEvent) {
		e.preventDefault();
		const s = slug.trim().replace(/^.*\//, '');
		if (!s) return;
		looking = true;
		itemError = '';
		item = null;
		try {
			item = await unwrap(
				api.catalog.GET('/api/v1/catalog/admin/search/sidecar/item', {
					params: { query: { slug: s } }
				})
			);
		} catch (err) {
			itemError = errorMessage(err);
		} finally {
			looking = false;
		}
	}

	// Состав карточки (`index::types::Card`, у людей — `PersonDoc`).
	const CARD_ENTITY: [string, string][] = [
		['id, kind, slug', 'идентификатор, вид, адрес страницы'],
		['title, original_title', 'название и оригинальное название'],
		['release_date, release_status', 'дата выхода и статус (у книг статус не хранится)'],
		['cover_url, cover_width, cover_height', 'обложка и её размеры'],
		['imdb_rating, imdb_votes', 'рейтинг IMDb и число голосов (из entity_stats)'],
		['authors', 'авторы книги: имя и slug']
	];
	const CARD_PERSON: [string, string][] = [
		['id, slug', 'идентификатор и адрес страницы'],
		['full_name, original_name', 'имя по-русски и в оригинале'],
		['birth_date, photo_url', 'дата рождения и фото'],
		['known_for', 'основная роль (actor, director…)'],
		['fame, works_count', 'известность и число работ'],
		['top_works', 'до 3 известных работ для карточки']
	];

	const groups = $derived(view ? groupParts(view.parts) : []);
	const sidecarTotal = $derived(view ? view.entities_bytes + view.people_bytes : 0);
	const num = (n: number) => n.toLocaleString('ru-RU');
	const day = (d: number) =>
		d
			? new Date(Date.UTC(1970, 0, 1) + (d - 719_163) * 86_400_000).toISOString().slice(0, 10)
			: '—';
</script>

<p class="mb-6 max-w-3xl text-sm text-base-content/60">
	Поиск состоит из двух слоёв. <b>Слой А</b> — текстовый индекс Tantivy на диске: названия, имена,
	сохранённые карточки; в память попадают только нужные запросу куски, и ОС может их вытеснить.
	<b>Слой Б</b>: у каждой сущности есть номер, и по этому номеру лежат флаги, балл, готовые порядки
	сортировок и битовые карты фильтров. Фильтр — пересечение битовых карт, сортировка — проход по
	готовому порядку. Массивы и порядки лежат в файле, отображённом в память (метка «файл»): в куче
	процесса их нет, ОС держит в RAM только прочитанное. В куче — мелкие фильтры и подсказки (метка
	«RAM»). Студии, издатели, музеи, награды и люди фильтруются через Tantivy.
</p>

{#if error}<Alert>{error}</Alert>{/if}

{#if view}
	<div class="mb-6 grid gap-3 sm:grid-cols-4">
		<div class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
			<div class="text-xs text-base-content/60">Процесс в RAM</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(view.process.rss)}</div>
		</div>
		<div class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
			<div class="text-xs text-base-content/60">Куча (анонимная)</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(view.process.anon)}</div>
			<div class="text-xs text-base-content/50">слой Б, кэши, буферы запросов</div>
		</div>
		<div class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
			<div class="text-xs text-base-content/60">Файлы индекса (mmap)</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(view.process.file)}</div>
			<div class="text-xs text-base-content/50">ОС вытеснит при нехватке</div>
		</div>
		<div class="rounded-box bg-primary/10 p-4 ring-1 ring-primary/30">
			<div class="text-xs text-base-content/60">Слой Б в куче</div>
			<div class="text-2xl font-bold tabular-nums">{formatBytes(view.heap_bytes)}</div>
			<div class="text-xs text-base-content/50">
				ещё {formatBytes(view.mapped_bytes)} в файлах (mmap) · {num(view.entities)} сущностей · {num(
					view.people
				)} людей
			</div>
		</div>
	</div>

	<p class="mb-4 text-xs text-base-content/50">
		Кэш ответов: {num(view.cache_pages)} страниц, {num(view.cache_ranked)} рядов выдачи,
		{num(view.cache_people)} страниц людей. Длина массивов: сущности {num(view.entity_slots)}, люди
		{num(view.people_slots)}.
		<button class="link" onclick={load}>Обновить</button>
	</p>

	<div class="mb-10 flex flex-col gap-6">
		{#each groups as g (g.group)}
			<section>
				<h2 class="mb-2 flex justify-between text-lg font-semibold">
					{g.group}<span class="text-base-content/60 tabular-nums">{formatBytes(g.bytes)}</span>
				</h2>
				<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
					<table class="table table-sm">
						<tbody>
							{#each g.parts as p (p.name)}
								<tr>
									<td class="w-48 font-mono text-xs">{p.name}</td>
									<td class="text-sm">{describePart(p.name)}</td>
									<td class="text-right text-base-content/60 tabular-nums">{num(p.items)}</td>
									<td class="w-40">
										<div class="flex items-center gap-2">
											<div class="h-2 flex-1 overflow-hidden rounded-full bg-base-300">
												<div
													class="h-full bg-primary"
													style:width="{sidecarTotal ? (p.bytes / sidecarTotal) * 100 : 0}%"
												></div>
											</div>
											<span class="w-16 text-right text-xs tabular-nums"
												>{formatBytes(p.bytes)}</span
											>
											<span
												class={['badge badge-xs', p.mapped ? 'badge-success' : 'badge-warning']}
												title={p.mapped
													? 'В отображённом файле: в куче нет, ОС держит в RAM только прочитанное'
													: 'В куче процесса'}>{p.mapped ? 'файл' : 'RAM'}</span
											>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/each}
	</div>

	<section class="max-w-4xl">
		<h2 class="mb-2 text-lg font-semibold">Что слой Б знает о записи</h2>
		<form class="mb-4 flex gap-2" onsubmit={lookup}>
			<input
				class="input-bordered input flex-1 input-sm"
				placeholder="slug или ссылка: how-to-train-your-dragon-2010, brad-pitt"
				bind:value={slug}
			/>
			<button class="btn btn-primary btn-sm" disabled={looking}>
				{#if looking}<span class="loading loading-xs loading-spinner"></span>{/if}Показать
			</button>
		</form>
		{#if itemError}<Alert>{itemError}</Alert>{/if}
		{#if item}
			<div class="grid gap-4 md:grid-cols-2">
				<div class="rounded-box bg-base-200 p-4 text-sm ring-1 ring-base-300">
					<div class="mb-2 text-base font-semibold">
						{item.title} <span class="badge badge-sm">{item.kind}</span>
					</div>
					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
						<dt class="text-base-content/60">Номер (ord)</dt>
						<dd class="tabular-nums">{item.ord}</dd>
						<dt class="text-base-content/60">Виден в выдаче</dt>
						<dd>{item.visible ? 'да' : 'нет'}</dd>
						{#if item.space === 'entity'}
							<dt class="text-base-content/60">Ручное место</dt>
							<dd>{item.manual_rank || '—'}</dd>
							<dt class="text-base-content/60">Флаги</dt>
							<dd>
								обложка {item.has_cover ? '✓' : '✗'} · описание {item.has_description ? '✓' : '✗'} · автор
								{item.has_author ? '✓' : '✗'}
							</dd>
							<dt class="text-base-content/60">Популярность (поиск)</dt>
							<dd class="tabular-nums">{num(item.popularity)}</dd>
							<dt class="text-base-content/60">Балл в слое Б</dt>
							<dd class="tabular-nums">
								{(item.rank / 1000).toFixed(3)}
								<span class="text-base-content/50"
									>(в БД: {item.db_rank_score?.toFixed(3) ??
										'нет — пересчитайте на «Сортировке»'})</span
								>
							</dd>
							<dt class="text-base-content/60">Дата выхода</dt>
							<dd>{day(item.release_day)}</dd>
						{:else}
							<dt class="text-base-content/60">Известность</dt>
							<dd class="tabular-nums">{item.popularity.toFixed(2)}</dd>
						{/if}
					</dl>
					<h3 class="mt-4 mb-1 font-semibold">Место в готовых порядках</h3>
					<table class="table table-xs">
						<tbody>
							{#each item.positions as p (p.order)}
								<tr>
									<td class="font-mono">{p.order}</td>
									<td class="text-right tabular-nums">
										{p.position == null ? 'не входит' : `${num(p.position + 1)} из ${num(p.of)}`}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if item.facets.length}
						<h3 class="mt-4 mb-1 font-semibold">В фильтрах (битовых картах)</h3>
						<div class="flex flex-wrap gap-1">
							{#each item.facets as f (f)}<span class="badge badge-ghost badge-sm">{f}</span>{/each}
						</div>
					{/if}
				</div>
				<div class="rounded-box bg-base-200 p-4 text-sm ring-1 ring-base-300">
					<div class="mb-1 font-semibold">Карточка в слое А (поле <code>card</code>)</div>
					<p class="mb-2 text-xs text-base-content/60">
						Её целиком отдают поиск и подсказки — поэтому в ответе есть IMDb, обложка и даты, хотя
						по ним не ищут. Хранится сжатой на диске (zstd, блоки по 64 КБ), обновляется при
						перестройке индекса.
					</p>
					<table class="table mb-2 table-xs">
						<tbody>
							{#each item.space === 'entity' ? CARD_ENTITY : CARD_PERSON as [field, about] (field)}
								<tr><td class="font-mono">{field}</td><td>{about}</td></tr>
							{/each}
						</tbody>
					</table>
					<pre class="overflow-x-auto rounded bg-base-300 p-2 text-xs">{JSON.stringify(
							item.card,
							null,
							2
						)}</pre>
				</div>
			</div>
		{/if}
	</section>
{:else if !error}
	<span class="loading loading-spinner"></span>
{/if}
