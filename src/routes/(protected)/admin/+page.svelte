<script lang="ts">
	import { JobInterrupted, emptyJob, runJob, type JobState } from '#lib/admin/job.ts';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import JobLog from '#lib/components/admin/JobLog.svelte';

	let reindexing = $state(false);
	let job = $state<JobState | null>(null);
	let error = $state('');

	/** Новый индекс меньше 80% текущего — бэкенд не переключил поиск; можно настоять. */
	const checkFailed = $derived(
		job?.steps.some((s) => s.step === 'check' && s.status === 'failed') ?? false
	);
	const result = $derived(job?.done?.reindex);

	// Перестроить поисковый индекс из PostgreSQL без простоя и пересобрать статику; ход — в лог.
	async function reindex(force = false) {
		reindexing = true;
		job = null;
		error = '';
		try {
			const stream = await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/search/reindex/stream', {
					params: { query: force ? { force: true } : {} },
					parseAs: 'stream'
				})
			);
			job = emptyJob();
			await runJob(stream!, (state) => (job = state));
		} catch (e) {
			error = e instanceof JobInterrupted ? e.message : errorMessage(e);
		} finally {
			reindexing = false;
		}
	}

	const cards = [
		{
			href: '/admin/entities',
			title: 'Произведения',
			text: 'Фильмы, сериалы, книги и игры: поля, обложки, трейлеры, теги, участники.'
		},
		{ href: '/admin/people', title: 'Люди', text: 'Актёры, режиссёры, авторы: фото и биографии.' },
		{ href: '/admin/tags', title: 'Теги', text: 'Жанры и темы, общие для всех разделов.' },
		{ href: '/admin/users', title: 'Пользователи', text: 'Роли и блокировки.' }
	];
</script>

<svelte:head><title>Админка — Nexus</title></svelte:head>

<h1 class="mb-6 text-3xl font-black">Админка</h1>

<ul class="mb-8 grid gap-3 sm:grid-cols-2">
	{#each cards as card (card.href)}
		<li>
			<a
				href={card.href}
				class="block h-full rounded-box bg-base-200 p-4 ring-1 ring-base-300 transition hover:ring-primary"
			>
				<span class="block text-lg font-semibold">{card.title}</span>
				<span class="mt-1 block text-sm text-base-content/60">{card.text}</span>
			</a>
		</li>
	{/each}
</ul>

<section aria-labelledby="search-title" class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
	<h2 id="search-title" class="font-semibold">Поисковый индекс</h2>
	<p class="mt-1 text-sm text-base-content/60">
		Правки в админке попадают в поиск и статику сами. Перестройка нужна, если данные загружали в
		обход API (например, <code>make seed</code>) или поиск разошёлся с каталогом. Поиск
		переключается на новый индекс без простоя, затем пересобирается вся статика сайта (в фоне).
	</p>
	<div class="mt-3 flex flex-wrap items-center gap-3">
		<button class="btn btn-sm" onclick={() => reindex()} disabled={reindexing}>
			{#if reindexing}<span class="loading loading-xs loading-spinner"></span>{/if}
			Перестроить индекс
		</button>
		{#if checkFailed && !reindexing}
			<button class="btn btn-outline btn-sm btn-warning" onclick={() => reindex(true)}>
				Перестроить без проверки
			</button>
		{/if}
		{#if result}
			<span class="text-sm text-base-content/60">
				В индексе {result.indexed.toLocaleString('ru-RU')}, было {result.previous_count.toLocaleString(
					'ru-RU'
				)}; предыдущая версия — <code>{result.previous_version}</code>
			</span>
		{/if}
	</div>
	{#if job}<div class="mt-3"><JobLog {job} label="Перестройка поиска" /></div>{/if}
	{#if error}<div class="mt-3"><Alert>{error}</Alert></div>{/if}
</section>
