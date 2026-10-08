<script lang="ts">
	import { JobInterrupted, emptyJob, runJob, type JobState } from '#lib/admin/job.ts';
	import { errorMessage } from '#lib/api/errors.ts';
	import Alert from '#lib/components/Alert.svelte';
	import JobLog from './JobLog.svelte';

	// Глобальная переиндексация одной сущности (произведения, позже — люди и др.): новый поисковый
	// индекс без простоя и пересборка всех её статических страниц. Ход — потоком JobEvent в лог.
	// start нет — индексации у бэкенда пока нет: блок виден, но выключен.
	let {
		id,
		title,
		what,
		start
	}: {
		id: string;
		/** «Произведения» — заголовок блока и подписи. */
		title: string;
		/** Что перестраивается — пунктами. */
		what: string[];
		/** Запустить на бэкенде; поток JobEvent. force — без проверки 80%. */
		start?: (force: boolean) => Promise<ReadableStream<Uint8Array>>;
	} = $props();

	let running = $state(false);
	let job = $state<JobState | null>(null);
	let error = $state('');

	/** Новый индекс меньше 80% текущего — бэкенд не переключил поиск; можно настоять. */
	const checkFailed = $derived(
		job?.steps.some((s) => s.step === 'check' && s.status === 'failed') ?? false
	);
	const result = $derived(job?.done?.reindex);
	/** Почему проверка не пропустила: «Новый индекс: 12 документов, текущий: 100 (12%)…». */
	const checkMessage = $derived(job?.steps.find((s) => s.step === 'check')?.message ?? '');

	// Подтверждение перед запуском: обычная переиндексация или без проверки 80% (force).
	let confirmDialog = $state<HTMLDialogElement>();
	let confirmForce = $state(false);

	function ask(force: boolean) {
		confirmForce = force;
		confirmDialog?.showModal();
	}

	function confirm() {
		confirmDialog?.close();
		void run(confirmForce);
	}

	async function run(force: boolean) {
		running = true;
		job = null;
		error = '';
		try {
			const stream = await start!(force);
			job = emptyJob();
			await runJob(stream, (state) => (job = state));
		} catch (e) {
			error = e instanceof JobInterrupted ? e.message : errorMessage(e);
		} finally {
			running = false;
		}
	}
</script>

<section
	aria-labelledby="{id}-title"
	class={['rounded-box bg-base-200 p-4 ring-1 ring-base-300', { 'opacity-60': !start }]}
>
	<div class="flex flex-wrap items-baseline justify-between gap-3">
		<h2 id="{id}-title" class="text-lg font-semibold">{title}</h2>
		{#if !start}<span class="badge badge-ghost badge-sm">скоро</span>{/if}
	</div>
	<ul class="mt-2 list-inside list-disc text-sm text-base-content/70">
		{#each what as item (item)}<li>{item}</li>{/each}
	</ul>

	{#if start}
		<div class="mt-3 flex flex-wrap items-center gap-3">
			<button class="btn btn-sm" onclick={() => ask(false)} disabled={running}>
				{#if running}<span class="loading loading-xs loading-spinner"></span>{/if}
				Переиндексировать
			</button>
			{#if checkFailed && !running}
				<button class="btn btn-outline btn-sm btn-warning" onclick={() => ask(true)}>
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
		{#if job}<div class="mt-3"><JobLog {job} label="Индексация: {title}" /></div>{/if}
		{#if error}<div class="mt-3"><Alert>{error}</Alert></div>{/if}
	{/if}
</section>

{#if start}
	<dialog
		bind:this={confirmDialog}
		class="modal"
		aria-labelledby="{id}-confirm-title"
		aria-describedby="{id}-confirm-text"
	>
		<div class="modal-box">
			{#if confirmForce}
				<h3 id="{id}-confirm-title" class="text-lg font-bold text-warning">
					Переключить поиск без проверки?
				</h3>
				<div id="{id}-confirm-text" class="mt-3 flex flex-col gap-2 text-sm">
					<p>
						Прошлая перестройка остановилась: новый индекс оказался меньше 80% текущего. Обычно это
						значит, что выборка из базы сломана или неполная.
					</p>
					{#if checkMessage}<p class="text-base-content/60">{checkMessage}</p>{/if}
					<p>
						Продолжайте, только если записи удалены <strong>намеренно</strong>: поиск для всех
						пользователей переключится на меньший индекс, затем пересоберутся все статические
						страницы раздела «{title}». Предыдущая версия индекса сохранится.
					</p>
				</div>
			{:else}
				<h3 id="{id}-confirm-title" class="text-lg font-bold">Переиндексировать «{title}»?</h3>
				<div id="{id}-confirm-text" class="mt-3 flex flex-col gap-2 text-sm">
					<p>
						Все записи из базы будут заново загружены в новый поисковый индекс, затем поиск
						переключится на него без простоя, а все статические страницы раздела пересоберутся в
						фоне.
					</p>
					<p class="text-base-content/60">
						На большом каталоге это занимает минуты и нагружает базу, Meilisearch и фронтенд-сервер.
						Если новый индекс окажется меньше 80% текущего, поиск не переключится, а страницы не
						пересоберутся.
					</p>
				</div>
			{/if}
			<div class="modal-action">
				<form method="dialog"><button class="btn btn-ghost btn-sm">Отмена</button></form>
				<button
					class={['btn btn-sm', confirmForce ? 'btn-warning' : 'btn-primary']}
					onclick={confirm}
				>
					{confirmForce ? 'Переключить без проверки' : 'Запустить'}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop"><button tabindex="-1">Закрыть</button></form>
	</dialog>
{/if}
