<script lang="ts">
	import { JobInterrupted, emptyJob, runJob, type JobState } from '#lib/admin/job.ts';
	import {
		KIND_TITLES,
		WEIGHTS,
		partShare,
		searchMix,
		toBody,
		type RankKind
	} from '#lib/admin/ranking.ts';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaKindPreviewRow, SchemaKindRanking } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import JobLog from '#lib/components/admin/JobLog.svelte';

	// Сортировка по видам: веса балла «Рекомендуемые» и доля популярности в поиске. Сохранение
	// пересчитывает балл вида в PostgreSQL и подменяет его в слое Б (секунды, без перестройки
	// Tantivy и статических страниц).
	let all = $state<SchemaKindRanking[] | null>(null);
	let kind = $state<RankKind>('movie');
	let form = $state<SchemaKindRanking | null>(null);
	let preview = $state<SchemaKindPreviewRow[] | null>(null);
	let previewing = $state(false);
	let saving = $state(false);
	let job = $state<JobState | null>(null);
	let error = $state('');

	const scored = $derived(kind !== 'person');

	async function load() {
		try {
			all = await unwrap(api.catalog.GET('/api/v1/catalog/admin/ranking/kinds'));
			pick(kind);
		} catch (e) {
			error = errorMessage(e);
		}
	}

	function pick(next: RankKind) {
		kind = next;
		const found = all?.find((k) => k.kind === next);
		form = found ? { ...found } : null;
		preview = null;
		job = null;
		error = '';
	}

	$effect(() => {
		void load();
	});

	async function runPreview() {
		if (!form || !scored) return;
		previewing = true;
		error = '';
		try {
			preview = await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/ranking/kinds/{kind}/preview', {
					params: { path: { kind }, query: { limit: 30 } },
					body: toBody(form)
				})
			);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			previewing = false;
		}
	}

	async function save() {
		if (!form) return;
		saving = true;
		error = '';
		job = null;
		try {
			const stream = (await unwrap(
				api.catalog.PUT('/api/v1/catalog/admin/ranking/kinds/{kind}/stream', {
					params: { path: { kind } },
					body: toBody(form),
					parseAs: 'stream'
				})
			))!;
			job = emptyJob();
			await runJob(stream, (state) => (job = state));
			await load();
		} catch (e) {
			error = e instanceof JobInterrupted ? e.message : errorMessage(e);
		} finally {
			saving = false;
		}
	}

	/** Все виды по очереди с их сохранёнными настройками (первый запуск, после импорта). */
	let applyingAll = $state('');
	async function applyAll() {
		if (!all) return;
		error = '';
		job = null;
		try {
			for (const k of all) {
				applyingAll = KIND_TITLES[k.kind as RankKind] ?? k.kind ?? '';
				const stream = (await unwrap(
					api.catalog.PUT('/api/v1/catalog/admin/ranking/kinds/{kind}/stream', {
						params: { path: { kind: k.kind! } },
						body: toBody(k),
						parseAs: 'stream'
					})
				))!;
				job = emptyJob();
				await runJob(stream, (state) => (job = state));
			}
			await load();
		} catch (e) {
			error = e instanceof JobInterrupted ? e.message : errorMessage(e);
		} finally {
			applyingAll = '';
		}
	}

	const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 3 });
</script>

<svelte:head><title>Сортировка — Админка — Кассандра</title></svelte:head>

<h1 class="mb-2 text-3xl font-black">Сортировка</h1>
<p class="mb-6 max-w-3xl text-sm text-base-content/60">
	Порядок «Рекомендуемые» и то, как популярность поднимает результаты поиска и подсказок. Балл
	считается в базе одним проходом, сайт подхватывает его за секунды — полная переиндексация не
	нужна.
</p>

<div role="tablist" class="tabs tabs-box mb-6 w-fit flex-wrap">
	{#each Object.entries(KIND_TITLES) as [k, title] (k)}
		<button
			role="tab"
			class={['tab', { 'tab-active': kind === k }]}
			aria-selected={kind === k}
			onclick={() => pick(k as RankKind)}>{title}</button
		>
	{/each}
</div>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

{#if form}
	<div class="flex max-w-3xl flex-col gap-6">
		<section class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
			<h2 class="text-lg font-semibold">Поиск и подсказки</h2>
			<p class="mb-3 text-sm text-base-content/60">
				Насколько популярное поднимается над точнее совпавшим. Совпадение в названии всегда выше
				совпадения только по людям, точное название — выше всего.
			</p>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">{searchMix(form.search_popularity)}</span>
				<input
					type="range"
					class="range range-sm"
					min="0"
					max="1"
					step="0.05"
					bind:value={form.search_popularity}
				/>
			</label>
		</section>

		{#if scored}
			<section class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<h2 class="text-lg font-semibold">Балл «Рекомендуемые»</h2>
				<p class="mb-3 text-sm text-base-content/60">
					Сумма составляющих (каждая от 0 до 1) с этими весами. Он же — популярность в поиске.
				</p>
				<div class="grid gap-4 sm:grid-cols-2">
					{#each WEIGHTS as w (w.key)}
						<label class="flex flex-col gap-1">
							<span class="flex justify-between text-sm font-medium"
								>{w.label}<span class="tabular-nums">{fmt(form[w.key])}</span></span
							>
							<input
								type="range"
								class="range range-xs"
								min="0"
								max="2"
								step="0.05"
								bind:value={form[w.key]}
							/>
							<span class="text-xs text-base-content/50">{w.hint}</span>
						</label>
					{/each}
				</div>
				<details class="mt-4">
					<summary class="cursor-pointer text-sm font-medium">Тонкие настройки</summary>
					<div class="mt-3 grid gap-4 sm:grid-cols-3">
						<label class="flex flex-col gap-1 text-sm">
							Доверие к голосам
							<input
								type="number"
								class="input-bordered input input-sm"
								min="0"
								bind:value={form.trust_votes}
							/>
							<span class="text-xs text-base-content/50">Меньше голосов — ближе к среднему</span>
						</label>
						<label class="flex flex-col gap-1 text-sm">
							Полураспад свежести, лет
							<input
								type="number"
								class="input-bordered input input-sm"
								min="0.1"
								step="0.5"
								bind:value={form.half_life_years}
							/>
						</label>
						<label class="flex flex-col gap-1 text-sm">
							Минимум голосов IMDb
							<input
								type="number"
								class="input-bordered input input-sm"
								min="0"
								bind:value={form.min_votes}
							/>
						</label>
					</div>
				</details>
			</section>
		{:else}
			<p class="text-sm text-base-content/60">
				Известность людей считается из голосов за их работы и роли в них (режиссёр и главные роли
				весят больше). Здесь настраивается только её доля в поиске.
			</p>
		{/if}

		<div class="flex flex-wrap gap-3">
			{#if scored}
				<button class="btn btn-sm" onclick={runPreview} disabled={previewing || saving}>
					{#if previewing}<span class="loading loading-xs loading-spinner"></span>{/if}
					Предпросмотр топа
				</button>
			{/if}
			<button class="btn btn-primary btn-sm" onclick={save} disabled={saving || !!applyingAll}>
				{#if saving}<span class="loading loading-xs loading-spinner"></span>{/if}
				Сохранить и применить
			</button>
			<button
				class="btn btn-ghost btn-sm"
				onclick={applyAll}
				disabled={saving || !!applyingAll}
				title="Пересчитать балл всех видов с сохранёнными настройками"
			>
				{#if applyingAll}<span class="loading loading-xs loading-spinner"></span>
					{applyingAll}…{:else}Пересчитать все виды{/if}
			</button>
		</div>

		{#if job}<JobLog {job} label="Применение: {KIND_TITLES[kind]}" />{/if}

		{#if preview}
			<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>#</th>
							<th>Название</th>
							<th class="text-right">Балл</th>
							<th>Из чего</th>
						</tr>
					</thead>
					<tbody>
						{#each preview as row, i (row.slug)}
							<tr>
								<td class="tabular-nums">{i + 1}</td>
								<td>
									{row.title}
									{#if row.release_date}<span class="text-base-content/50">
											{row.release_date.slice(0, 4)}</span
										>{/if}
								</td>
								<td class="text-right tabular-nums">{fmt(row.score)}</td>
								<td class="min-w-48">
									<div
										class="flex h-2 overflow-hidden rounded-full bg-base-300"
										title="рейтинг {fmt(row.q_part)} · популярность {fmt(
											row.p_part
										)} · свежесть {fmt(row.r_part)} · сайт {fmt(row.s_part)} · полнота {fmt(
											row.c_part
										)}"
									>
										<span class="bg-primary" style:width="{partShare(row.q_part, row.score)}%"
										></span>
										<span class="bg-secondary" style:width="{partShare(row.p_part, row.score)}%"
										></span>
										<span class="bg-accent" style:width="{partShare(row.r_part, row.score)}%"
										></span>
										<span class="bg-info" style:width="{partShare(row.s_part, row.score)}%"></span>
										<span class="bg-success" style:width="{partShare(row.c_part, row.score)}%"
										></span>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="p-2 text-xs text-base-content/50">
					Полоса: <span class="text-primary">рейтинг</span> ·
					<span class="text-secondary">популярность</span> ·
					<span class="text-accent">свежесть</span> · <span class="text-info">сайт</span> ·
					<span class="text-success">полнота</span>
				</p>
			</div>
		{/if}
	</div>
{:else if !error}
	<span class="loading loading-spinner"></span>
{/if}
