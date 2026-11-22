<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ApiError, errorMessage } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import {
		JOB_STATUS_TITLES,
		cancelJob,
		cleanValues,
		emptyValues,
		jobLog,
		listJobs,
		listScripts,
		previewArgs,
		runScript,
		scriptProgress,
		scriptReport,
		type ScriptProgress,
		type FlagValues,
		type JobInfo,
		type Script
	} from '#lib/catalog/scripts.ts';
	import { listAiProviders, type AiProvider } from '#lib/catalog/ai.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Скрипты: слева реестр (группы), справа — описание, форма флагов с подсказками, запуск,
	// живой лог (опрос раз в секунду со строки lines_total), отмена и отчёт сухого прогона.
	// Одновременно идёт одна задача — бэкенд отвечает 409, если занято.
	const POLL_MS = 1000;

	let scripts = $state<Script[]>([]);
	let providers = $state<AiProvider[]>([]);
	let selected = $state<Script | null>(null);
	let values = $state<FlagValues>({});
	let fieldErrors = $state<Record<string, string>>({});
	let error = $state('');
	let jobs = $state<JobInfo[]>([]);
	let job = $state<JobInfo | null>(null);
	let lines = $state<string[]>([]);
	let report = $state<string | null>(null);
	let progress = $state<ScriptProgress | null>(null);
	let reportOpen = $state(false);
	let starting = $state(false);
	/** Перестроить поиск после записи (долго — по умолчанию нет). */
	let reindex = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let logBox = $state<HTMLPreElement>();

	const groups = $derived(
		Object.entries(
			Object.groupBy(scripts, (s) => s.group) as Record<string, Script[] | undefined>
		).map(([group, list]) => ({ group, list: list ?? [] }))
	);
	const running = $derived(jobs.some((j) => j.status === 'running'));

	async function load() {
		try {
			[scripts, jobs, providers] = await Promise.all([
				listScripts(api),
				listJobs(api),
				listAiProviders(api)
			]);
			if (!selected && scripts[0]) select(scripts[0]);
			const live = jobs.find((j) => j.status === 'running');
			if (live) watch(live);
		} catch (e) {
			error = errorMessage(e);
		}
	}
	void load();
	onDestroy(() => clearTimeout(timer));

	async function loadProgress() {
		if (!selected?.has_progress) return;
		try {
			progress = await scriptProgress(api, selected.id);
		} catch (e) {
			error = errorMessage(e);
		}
	}

	function select(script: Script) {
		selected = script;
		progress = null;
		void loadProgress();
		values = emptyValues(script);
		fieldErrors = {};
		error = '';
		report = null;
		reportOpen = false;
	}

	/** Номер следующей строки лога, которую надо запросить. */
	let next = 0;

	function watch(target: JobInfo) {
		clearTimeout(timer);
		job = target;
		lines = [];
		next = 0;
		void poll();
	}

	async function poll() {
		if (!job) return;
		const id = job.id;
		try {
			const log = await jobLog(api, id, next);
			if (job?.id !== id) return;
			const atBottom = logBox
				? logBox.scrollHeight - logBox.scrollTop - logBox.clientHeight < 40
				: true;
			const skipped = log.from > next ? [`… пропущено строк: ${log.from - next}`] : [];
			lines = [...lines, ...skipped, ...log.lines];
			next = log.from + log.lines.length;
			job = {
				id: log.id,
				script: log.script,
				args: log.args,
				status: log.status,
				exit_code: log.exit_code,
				started_at: log.started_at,
				finished_at: log.finished_at,
				lines_total: log.lines_total
			};
			if (atBottom) requestAnimationFrame(() => logBox?.scrollTo({ top: logBox.scrollHeight }));
			if (log.status === 'running') {
				timer = setTimeout(poll, POLL_MS);
			} else {
				jobs = await listJobs(api);
				void loadProgress();
				if (selected?.has_report && reportOpen) void loadReport();
			}
		} catch (e) {
			error = errorMessage(e);
		}
	}

	/** Ждут записи — уже обработаны ИИ, но не в БД; новый запуск их только покажет снова. */
	const pending = $derived((progress?.pending_write ?? 0) > 0);

	async function start(event: SubmitEvent) {
		event.preventDefault();
		await launch(false);
	}

	/** Только перестройка поиска: скрипт не запускается. */
	async function rebuild() {
		if (!selected) return;
		error = '';
		starting = true;
		try {
			const started = await runScript(api, selected.id, { reindex: true });
			jobs = [started, ...jobs];
			watch(started);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			starting = false;
		}
	}

	/** write — записать уже обработанное (--yes); без него — обработать и показать отчёт. */
	async function launch(write: boolean) {
		if (!selected) return;
		error = '';
		fieldErrors = {};
		starting = true;
		try {
			const flags = {
				...cleanValues(selected, values),
				...(write ? { yes: true } : {}),
				...(write && reindex ? { reindex: true } : {})
			};
			const started = await runScript(api, selected.id, flags);
			jobs = [started, ...jobs];
			watch(started);
		} catch (e) {
			if (e instanceof ApiError && e.field) fieldErrors = { [e.field]: errorMessage(e) };
			else error = errorMessage(e);
		} finally {
			starting = false;
		}
	}

	async function cancel() {
		if (!job) return;
		try {
			await cancelJob(api, job.id);
		} catch (e) {
			error = errorMessage(e);
		}
	}

	async function loadReport() {
		if (!selected) return;
		try {
			report = await scriptReport(api, selected.id);
		} catch (e) {
			report = e instanceof ApiError && e.status === 404 ? '' : null;
			if (!(e instanceof ApiError && e.status === 404)) error = errorMessage(e);
		}
	}

	function openJob(j: JobInfo) {
		const script = scripts.find((s) => s.id === j.script);
		if (script && script !== selected) select(script);
		watch(j);
	}

	const time = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU');
	const statusClass = (s: JobInfo['status']) =>
		({
			running: 'badge-info',
			succeeded: 'badge-success',
			failed: 'badge-error',
			stopped: 'badge-warning',
			cancelled: 'badge-ghost'
		})[s];
</script>

<svelte:head><title>Скрипты — админка</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold">Скрипты</h1>
<p class="mb-4 text-sm text-base-content/70">
	Служебные скрипты с флагами. Ключи ИИ берутся из раздела
	<a class="link" href="/admin/ai">«Провайдеры ИИ»</a>. Одновременно идёт один скрипт.
</p>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

<div class={['grid gap-6', (scripts.length > 1 || jobs.length > 0) && 'xl:grid-cols-[16rem_1fr]']}>
	<nav aria-label="Скрипты" class="flex flex-col gap-4">
		{#each scripts.length > 1 ? groups : [] as g (g.group)}
			<div>
				<p class="mb-1 px-3 text-xs font-semibold tracking-widest text-primary uppercase">
					{g.group}
				</p>
				<ul class="menu w-full rounded-box bg-base-200 p-2 ring-1 ring-base-300">
					{#each g.list as s (s.id)}
						<li>
							<button
								type="button"
								class={{ 'menu-active': selected?.id === s.id }}
								onclick={() => select(s)}>{s.title}</button
							>
						</li>
					{/each}
				</ul>
			</div>
		{/each}

		{#if jobs.length > 0}
			<div>
				<p class="mb-1 px-3 text-xs font-semibold tracking-widest text-primary uppercase">
					Запуски
				</p>
				<ul class="menu w-full menu-sm rounded-box bg-base-200 p-2 ring-1 ring-base-300">
					{#each jobs as j (j.id)}
						<li>
							<button
								type="button"
								class={{ 'menu-active': job?.id === j.id }}
								onclick={() => openJob(j)}
							>
								<span class="badge badge-xs {statusClass(j.status)}"></span>
								<span class="truncate">{j.script}</span>
								<span class="ml-auto text-xs opacity-60">{time(j.started_at)}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</nav>

	<div class="min-w-0">
		{#if selected}
			<section class="mb-6 rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<h2 class="text-lg font-semibold">{selected.title}</h2>
				<p class="mt-2 text-sm whitespace-pre-line">{selected.description}</p>
				<p class="mt-2 text-xs text-base-content/60">
					В терминале: <code>{selected.command}</code>
				</p>

				{#if progress}
					{@const done = progress.total - progress.remaining}
					<div class="mt-4 rounded bg-base-100 p-3 ring-1 ring-base-300">
						<div class="mb-1 flex flex-wrap justify-between gap-2 text-sm">
							<span
								>Нормализовано <b>{done.toLocaleString('ru-RU')}</b> из
								{progress.total.toLocaleString('ru-RU')}</span
							>
							<span>осталось <b>{progress.remaining.toLocaleString('ru-RU')}</b></span>
						</div>
						<progress
							class="progress w-full progress-primary"
							value={done}
							max={progress.total || 1}
						></progress>
						<div class="mt-1 flex flex-wrap gap-x-4 text-xs text-base-content/60">
							<span>размечено ИИ: {progress.classified.toLocaleString('ru-RU')}</span>
							<span>записано: {progress.written.toLocaleString('ru-RU')}</span>
							{#if progress.pending_write > 0}<span class="text-warning"
									>ждут записи: {progress.pending_write.toLocaleString('ru-RU')}</span
								>{/if}
							{#if progress.exported_not_classified > 0}<span class="text-warning"
									>начатая порция: {progress.exported_not_classified}</span
								>{/if}
							<span
								>последняя пачка: {progress.last_batch === null
									? '—'
									: String(progress.last_batch).padStart(4, '0')}</span
							>
							<span>обновлено: {new Date(progress.updated_at).toLocaleString('ru-RU')}</span>
						</div>
					</div>
				{/if}

				{#if pending && progress}
					<div class="mt-4">
						<Alert kind="warning">
							<div class="flex flex-wrap items-center gap-3">
								<span
									><b>{progress.pending_write.toLocaleString('ru-RU')}</b> книг уже обработаны ИИ, но
									не записаны в БД. Повторный запуск их заново не обрабатывает — проверьте отчёт и запишите.</span
								>
								<button
									type="button"
									class="btn btn-sm btn-warning"
									disabled={starting || running}
									onclick={() => launch(true)}>Записать в БД</button
								>
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" class="checkbox checkbox-sm" bind:checked={reindex} />
									и перестроить поиск (~10 мин)
								</label>
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={async () => {
										reportOpen = true;
										await loadReport();
									}}>Открыть отчёт</button
								>
							</div>
						</Alert>
					</div>
				{/if}

				<form class="mt-4 grid gap-4" onsubmit={start} novalidate>
					{#each selected.flags.filter((f) => f.name !== 'yes' && f.name !== 'reindex') as flag (flag.name)}
						<div class="grid gap-1 md:grid-cols-[12rem_1fr] md:items-start md:gap-4">
							{#if flag.type === 'bool'}
								<label class="flex items-center gap-2 pt-1 font-mono text-sm">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={values[flag.name] === true}
										onchange={(e) => (values[flag.name] = e.currentTarget.checked)}
									/>
									--{flag.name}
								</label>
							{:else}
								<label class="pt-1 font-mono text-sm" for="flag-{flag.name}">--{flag.name}</label>
							{/if}
							<div>
								{#if flag.type === 'int'}
									<input
										id="flag-{flag.name}"
										class="input w-40 input-sm"
										type="number"
										min={flag.min}
										max={flag.max}
										placeholder={flag.default ?? ''}
										bind:value={values[flag.name]}
									/>
								{:else if flag.type === 'choice'}
									<select
										id="flag-{flag.name}"
										class="select w-48 select-sm"
										bind:value={values[flag.name]}
									>
										<option value="">— по умолчанию —</option>
										{#each flag.options as o (o)}<option value={o}>{o}</option>{/each}
									</select>
								{:else if flag.type === 'ai_provider'}
									<select
										id="flag-{flag.name}"
										class="select w-72 select-sm"
										bind:value={values[flag.name]}
									>
										<option value="">
											По умолчанию{providers.find((p) => p.is_default)
												? ` — ${providers.find((p) => p.is_default)?.slug}`
												: ''}
										</option>
										{#each providers as p (p.slug)}
											<option value={p.slug}>{p.slug} — {p.model}, effort {p.effort}</option>
										{/each}
									</select>
									{#if providers.length === 0}
										<p class="mt-1 text-xs text-warning">
											Провайдеров нет — <a class="link" href="/admin/ai">добавьте ключ</a>.
										</p>
									{/if}
								{:else if flag.type === 'text'}
									<input
										id="flag-{flag.name}"
										class="input w-full max-w-md input-sm"
										placeholder={flag.default ?? ''}
										autocomplete="off"
										bind:value={values[flag.name]}
									/>
								{/if}
								<p class="mt-1 text-xs text-base-content/70">
									{flag.description}
									{#if flag.type === 'int'}<span class="opacity-60">
											({flag.min}–{flag.max}{flag.default
												? `, по умолчанию ${flag.default}`
												: ''})</span
										>{/if}
								</p>
								{#if fieldErrors[flag.name]}
									<p class="mt-1 text-xs text-error">{fieldErrors[flag.name]}</p>
								{/if}
							</div>
						</div>
					{/each}

					<div class="rounded bg-base-300 px-3 py-2 font-mono text-xs break-all">
						{selected.command.split(' [')[0]}
						{previewArgs(selected, values)}
					</div>
					{#if selected.after === 'books_reindex'}
						<p class="text-xs text-base-content/60">
							Поиск после записи не перестраивается, если не отметить галочку у «Записать в БД».
							Перестроить можно в любой момент кнопкой «Пересобрать поиск» (~10 мин).
						</p>
					{/if}
					<div class="flex flex-wrap gap-2">
						<button
							class="btn btn-primary btn-sm"
							disabled={starting || running || pending}
							title={pending ? 'Сначала запишите уже обработанные книги' : undefined}
						>
							{running
								? 'Идёт скрипт…'
								: starting
									? 'Запускаю…'
									: pending
										? 'Сначала запишите обработанное'
										: 'Обработать (без записи)'}
						</button>
						{#if selected.after === 'books_reindex'}
							<button
								type="button"
								class="btn btn-outline btn-sm"
								disabled={starting || running}
								onclick={rebuild}>Пересобрать поиск</button
							>
						{/if}
						{#if selected.has_report}
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={async () => {
									reportOpen = !reportOpen;
									if (reportOpen) await loadReport();
								}}>{reportOpen ? 'Скрыть отчёт' : 'Отчёт обработки'}</button
							>
						{/if}
					</div>
				</form>
			</section>
		{/if}

		{#if job}
			<section class="mb-6">
				<div class="mb-2 flex flex-wrap items-center gap-2">
					<h2 class="text-lg font-semibold">Запуск #{job.id}: {job.script}</h2>
					<span class="badge {statusClass(job.status)}">{JOB_STATUS_TITLES[job.status]}</span>
					{#if job.exit_code !== null && job.exit_code !== undefined}
						<span class="text-xs opacity-60">код {job.exit_code}</span>
					{/if}
					{#if job.status === 'running'}
						<button type="button" class="btn btn-outline btn-error btn-xs" onclick={cancel}
							>Остановить</button
						>
					{/if}
				</div>
				{#if job.status === 'stopped'}
					<div class="mb-2">
						<Alert kind="warning"
							>Обработка готова, в БД ещё ничего не записано. Посмотрите отчёт и нажмите «Записать в
							БД» — книги заново обрабатываться не будут.</Alert
						>
					</div>
				{/if}
				<pre
					bind:this={logBox}
					class="max-h-[32rem] overflow-auto rounded-box bg-neutral p-3 text-xs leading-relaxed text-neutral-content">{lines.join(
						'\n'
					) || '…'}</pre>
			</section>
		{/if}

		{#if reportOpen}
			<section>
				<h2 class="mb-2 text-lg font-semibold">Отчёт</h2>
				{#if report === null}
					<p class="text-sm opacity-60">Загрузка…</p>
				{:else if report === ''}
					<Alert kind="info">Отчёта ещё нет — запустите скрипт.</Alert>
				{:else}
					<pre
						class="max-h-[40rem] overflow-auto rounded-box bg-base-200 p-3 text-xs whitespace-pre-wrap">{report}</pre>
				{/if}
			</section>
		{/if}
	</div>
</div>
