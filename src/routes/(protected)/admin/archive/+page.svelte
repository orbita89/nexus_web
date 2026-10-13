<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ARCHIVE_LIMIT, formatPopularity, originalTitle, tmdbHref } from '#lib/admin/archive.ts';
	import { Promotions } from '#lib/admin/promote.svelte.ts';
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import { readText, withQuery } from '#lib/catalog/url.ts';
	import Alert from '#lib/components/Alert.svelte';
	import PromoteButton from '#lib/components/admin/PromoteButton.svelte';
	import PromoteToasts from '#lib/components/admin/PromoteToasts.svelte';

	// /admin/archive?q=hamlet — поиск по холодному архиву и возврат фильма на сайт. q живёт в
	// адресе (ссылкой можно поделиться, «назад» возвращает к выдаче); ввод пишется в адрес через
	// 300 мс без новой записи в истории.
	const q = $derived(readText(page.url, 'q'));
	let text = $state(readText(page.url, 'q') ?? '');
	let docs = $state<SchemaArchiveDoc[]>([]);
	/** Пришёл полный лимит — дальше бэкенд не отдаёт, просим уточнить. */
	let full = $state(false);
	let loading = $state(false);
	let error = $state('');
	let unavailable = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	/** Номер запроса: ответ на устаревший поиск отбрасываем. */
	let request = 0;

	const promotions = new Promotions((slug) => (docs = docs.filter((d) => d.slug !== slug)));

	// «Назад», «вперёд», ссылка — поле ввода следует за адресом; свой goto поле не трогает,
	// иначе стёр бы то, что успели допечатать за 300 мс.
	afterNavigate(({ type }) => {
		if (type !== 'goto') text = q ?? '';
	});

	$effect(() => {
		void search(q);
	});

	async function search(query: string | undefined) {
		const id = ++request;
		error = '';
		unavailable = false;
		if (!query) {
			docs = [];
			full = loading = false;
			return;
		}
		loading = true;
		try {
			const hits = await unwrap(
				guestApi.catalog.GET('/api/v1/catalog/archive/search', {
					params: { query: { q: query, limit: ARCHIVE_LIMIT } }
				})
			);
			if (id !== request) return;
			docs = hits.items;
			full = hits.items.length === ARCHIVE_LIMIT;
		} catch (e) {
			if (id !== request) return;
			docs = [];
			full = false;
			unavailable = e instanceof ApiError && e.status === 503;
			error = errorMessage(e);
		} finally {
			if (id === request) loading = false;
		}
	}

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const url = withQuery(page.url.pathname, { q: text });
			if (url !== withQuery(page.url.pathname, { q })) {
				goto(url, { replace: true, reset: false });
			}
		}, 300);
	}
</script>

<svelte:head><title>Архив — Админка — Nexus</title></svelte:head>

<h1 class="mb-2 text-3xl font-black">Архив</h1>
<p class="mb-6 max-w-2xl text-sm text-base-content/60">
	Фильмы TMDB, которых нет на сайте: вне топ-100 000. Ищутся все слова в русском или оригинальном
	названии, без опечаток и словоформ («дюна» найдёт «Дюна», «дюны» — нет).
</p>

<form class="mb-6 max-w-xl" role="search" onsubmit={(e) => e.preventDefault()}>
	<input
		type="search"
		bind:value={text}
		oninput={onInput}
		maxlength="200"
		placeholder="Название фильма"
		aria-label="Поиск по архиву"
		class="input w-full"
	/>
</form>

{#if !q}
	<p class="text-base-content/60">Введите название.</p>
{:else if unavailable}
	<Alert kind="warning">Архив временно недоступен. Попробуйте позже.</Alert>
{:else if error}
	<Alert>{error}</Alert>
{:else if loading && !docs.length}
	<p class="flex items-center gap-2 text-base-content/60">
		<span class="loading loading-sm loading-spinner"></span>Ищем…
	</p>
{:else if !docs.length}
	<p class="text-base-content/60">В архиве ничего не нашлось по запросу «{q}».</p>
{:else}
	<div class={['overflow-x-auto transition-opacity', { 'opacity-60': loading }]}>
		<table class="table table-sm">
			<thead>
				<tr>
					<th>Название</th>
					<th>Год</th>
					<th class="text-right">Popularity</th>
					<th>TMDB</th>
					<th><span class="sr-only">Действия</span></th>
				</tr>
			</thead>
			<tbody>
				{#each docs as doc (doc.slug)}
					{@const original = originalTitle(doc)}
					<tr>
						<td>
							<p class="font-medium">{doc.title}</p>
							{#if original}<p class="text-xs text-base-content/50">{original}</p>{/if}
						</td>
						<td class="whitespace-nowrap">{yearOf(doc.release_date) ?? '—'}</td>
						<td class="text-right tabular-nums">{formatPopularity(doc.popularity)}</td>
						<td>
							{#if doc.tmdb_id !== null && doc.tmdb_id !== undefined}
								<a
									href={tmdbHref(doc.tmdb_id)}
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary">{doc.tmdb_id}</a
								>
							{:else}—{/if}
						</td>
						<td class="text-right"><PromoteButton {doc} {promotions} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if full}
		<p class="mt-3 text-sm text-base-content/50">
			Показаны {ARCHIVE_LIMIT} лучших совпадений — уточните запрос.
		</p>
	{/if}
{/if}

<PromoteToasts {promotions} />
