<script lang="ts">
	import type { JobState, StepState } from '#lib/admin/job.ts';

	// Лог операции бэкенда (публикация правки, перестройка поиска): шаги из plan по порядку,
	// у каждого — статус, сообщение, время, у длинных — прогресс. Состояние — из runJob.
	let { job, label = 'Ход операции' }: { job: JobState; label?: string } = $props();

	const ICON: Record<StepState['status'], string> = {
		pending: '○',
		running: '',
		done: '✓',
		skipped: '–',
		failed: '✕'
	};
	const STATUS: Record<StepState['status'], string> = {
		pending: 'ожидает',
		running: 'идёт',
		done: 'готово',
		skipped: 'пропущен',
		failed: 'ошибка'
	};

	const duration = (ms: number) =>
		ms < 1000
			? `${ms} мс`
			: `${(ms / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} с`;
	const number = (n: number) => n.toLocaleString('ru-RU');
</script>

<section aria-label={label} class="rounded-box bg-base-200 p-4 text-sm ring-1 ring-base-300">
	<ol class="flex flex-col gap-2" role="log" aria-live="polite">
		{#each job.steps as s (s.step)}
			<li class="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2">
				<span
					aria-label={STATUS[s.status]}
					class={[
						'text-center font-bold',
						{
							'text-base-content/30': s.status === 'pending' || s.status === 'skipped',
							'text-success': s.status === 'done',
							'text-error': s.status === 'failed'
						}
					]}
				>
					{#if s.status === 'running'}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						{ICON[s.status]}
					{/if}
				</span>
				<span class="min-w-0">
					<span class={['font-medium', { 'text-base-content/50': s.status === 'pending' }]}
						>{s.title}</span
					>
					{#if s.message}
						<span
							class={[
								'block break-words',
								s.status === 'failed' ? 'text-error' : 'text-base-content/60'
							]}>{s.message}</span
						>
					{/if}
					{#if s.progress && s.status === 'running'}
						<span class="mt-1 flex items-center gap-2">
							<progress
								class="progress w-48 progress-primary"
								value={s.progress.done}
								max={s.progress.total || 1}
							></progress>
							<span class="text-xs text-base-content/60 tabular-nums"
								>{number(s.progress.done)} из {number(s.progress.total)}</span
							>
						</span>
					{/if}
				</span>
				<span class="text-xs text-base-content/40 tabular-nums">
					{s.durationMs != null ? duration(s.durationMs) : ''}
				</span>
			</li>
		{/each}
	</ol>
	{#if job.done}
		<p role="status" class={['mt-3 font-semibold', job.done.ok ? 'text-success' : 'text-error']}>
			{job.done.ok ? 'Готово' : 'Завершено с ошибками — см. шаги выше'}
		</p>
	{/if}
</section>
