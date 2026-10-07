<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';

	// Действие модератора с подтверждением: «Удалить» → «Удалить … ? Да / Отмена».
	let {
		label,
		question,
		action
	}: {
		label: string;
		question: string;
		/** Сам запрос; после успеха вызывающий перечитывает данные. */
		action: () => Promise<unknown>;
	} = $props();

	let confirming = $state(false);
	let busy = $state(false);
	let error = $state('');

	async function run() {
		busy = true;
		error = '';
		try {
			await action();
			confirming = false;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if confirming}
	<span class="inline-flex flex-wrap items-center gap-2 text-sm">
		<span class="badge badge-sm badge-warning">модерация</span>
		{question}
		<button class="btn btn-error btn-xs" onclick={run} disabled={busy}>Да</button>
		<button class="btn btn-ghost btn-xs" onclick={() => (confirming = false)}>Отмена</button>
	</span>
{:else}
	<button class="btn btn-ghost text-warning btn-xs" onclick={() => (confirming = true)}
		>🛡 {label}</button
	>
{/if}
{#if error}<span role="alert" class="text-xs text-error">{error}</span>{/if}
