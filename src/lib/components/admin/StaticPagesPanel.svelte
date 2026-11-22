<script lang="ts">
	import { bookPagePath, formatDuration } from '#lib/admin/books-index.ts';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaStaticRun } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Статические страницы книг: готовые HTML и __data.json, которые nginx отдаёт с диска. Их
	// рисует сервер фронтенда (server/isr.js) — бэкенд только передаёт команду и ход
	// (/admin/static/*). Пока идёт пересборка, опрашиваем ход раз в 3 секунды.
	const POLL_MS = 3000;

	let run = $state<SchemaStaticRun | null>(null);
	let error = $state('');
	let notice = $state('');
	let busy = $state(false);
	let confirmAll = $state(false);
	let one = $state('');

	const running = $derived(!!run?.running);
	const percent = $derived(run && run.total ? Math.round((run.done / run.total) * 100) : 0);

	async function load() {
		try {
			run = (await unwrap(api.catalog.GET('/api/v1/catalog/admin/static/status'))).run ?? null;
		} catch (e) {
			error = errorMessage(e);
		}
	}

	$effect(() => {
		void load();
	});

	$effect(() => {
		if (!running) return;
		const timer = setInterval(load, POLL_MS);
		return () => clearInterval(timer);
	});

	async function regenerateAll() {
		confirmAll = false;
		busy = true;
		error = notice = '';
		try {
			const { started } = await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/static/regenerate', { body: { kind: 'book' } })
			);
			notice = started ? 'Пересборка страниц книг запущена.' : 'Пересборка уже идёт.';
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
			await load();
		}
	}

	async function regenerateOne(e: SubmitEvent) {
		e.preventDefault();
		const path = bookPagePath(one);
		error = notice = '';
		if (!path) {
			error = 'Укажите slug книги или ссылку на неё: belaya-gvardiya или …/books/belaya-gvardiya.';
			return;
		}
		busy = true;
		try {
			await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/static/pages', { body: { paths: [path] } })
			);
			notice = `Страница ${path} перерисована.`;
			one = '';
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	const date = (iso: string) =>
		new Date(iso).toLocaleString('ru', { dateStyle: 'medium', timeStyle: 'medium' });
	const num = (n: number) => n.toLocaleString('ru');
</script>

<section class="rounded-box bg-base-200 p-4">
	<h2 class="mb-1 text-lg font-bold">Статические страницы книг</h2>
	<p class="mb-3 text-sm text-base-content/60">
		Готовые HTML книг, которые сайт отдаёт с диска без запросов к базе. Неизменившиеся страницы не
		перезаписываются — их кэш у читателей не сбрасывается.
	</p>

	{#if error}<div class="mb-3"><Alert>{error}</Alert></div>{/if}
	{#if notice}<div role="status" class="mb-3 alert alert-soft alert-success">{notice}</div>{/if}

	<div class="mb-3 flex flex-wrap items-center gap-2">
		{#if confirmAll}
			<span class="text-sm">Перерисовать все страницы книг? Это долго (сотни тысяч страниц).</span>
			<button class="btn btn-error btn-sm" onclick={regenerateAll}>Да, перерисовать</button>
			<button class="btn btn-ghost btn-sm" onclick={() => (confirmAll = false)}>Отмена</button>
		{:else}
			<button
				class="btn btn-primary btn-sm"
				disabled={busy || running}
				onclick={() => (confirmAll = true)}>Перегенерировать все книги</button
			>
		{/if}
		<form class="join" onsubmit={regenerateOne}>
			<input
				class="input join-item w-64 input-sm"
				placeholder="slug или ссылка на книгу"
				aria-label="Книга для перерисовки"
				bind:value={one}
			/>
			<button class="btn join-item btn-sm" disabled={busy || !one.trim()}>Перерисовать</button>
		</form>
		{#if busy}<span class="loading loading-sm loading-spinner"></span>{/if}
	</div>

	{#if run}
		<div class="text-sm">
			<p class="flex flex-wrap items-center gap-2">
				<strong>Последняя пересборка{run.kind ? '' : ' (вся статика)'}</strong>
				{#if run.running}
					<span class="badge badge-soft badge-info"
						><span class="loading loading-xs loading-spinner"></span>идёт</span
					>
				{:else if run.error}
					<span class="badge badge-soft badge-error">прервана</span>
				{:else}
					<span class="badge badge-soft badge-success">готово</span>
				{/if}
			</p>
			<progress class="progress my-2 w-full progress-primary" value={percent} max="100"></progress>
			<p class="text-base-content/60">
				{num(run.done)} из {num(run.total)} · изменено {num(run.changed)} · ошибок {num(
					run.failed.length
				)} · начата {date(run.started_at)}{#if run.finished_at}, длилась {formatDuration(
						new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()
					)}{/if}
			</p>
			{#if run.error}
				<pre
					class="mt-2 rounded bg-error/10 p-2 text-xs whitespace-pre-wrap text-error">{run.error}</pre>
			{/if}
			{#if run.failed.length}
				<details class="mt-2">
					<summary class="cursor-pointer">Страницы с ошибкой</summary>
					<ul class="mt-1 font-mono text-xs">
						{#each run.failed as f (f.path)}
							<li>{f.path} — {f.status}</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>
	{/if}
</section>
