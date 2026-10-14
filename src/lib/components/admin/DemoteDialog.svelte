<script lang="ts">
	import { DEMOTE_WARNING, demoteError, demoteSummary, skipReason } from '#lib/admin/demote.ts';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaDemoteResult } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	// «В архив»: подтверждение с предупреждением → POST /admin/archive/demote → итог в том же
	// окне (сколько перенесено, кто пропущен и почему). onclose — с итогом, если перенос был.
	let {
		slugs,
		titles = {},
		onclose
	}: {
		slugs: string[];
		/** slug → название, чтобы в списке пропущенных было понятно, что это. */
		titles?: Record<string, string>;
		onclose: (result: SchemaDemoteResult | null) => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let busy = $state(false);
	let error = $state('');
	let result = $state<SchemaDemoteResult | null>(null);
	let asked = $state(0);

	export function open() {
		error = '';
		result = null;
		dialog?.showModal();
	}

	async function demote() {
		busy = true;
		error = '';
		asked = slugs.length;
		try {
			result = await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/archive/demote', { body: { slugs } })
			);
		} catch (e) {
			error = demoteError(e);
		} finally {
			busy = false;
		}
	}

	function close() {
		dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	class="modal"
	aria-labelledby="demote-title"
	onclose={() => onclose(result)}
>
	<div class="modal-box">
		<h3 id="demote-title" class="text-lg font-bold">
			{slugs.length === 1
				? `Перенести «${titles[slugs[0]] ?? slugs[0]}» в архив?`
				: `Перенести в архив фильмов: ${slugs.length}?`}
		</h3>
		{#if result}
			<div class="mt-4 flex flex-col gap-3">
				<Alert kind={result.archived.length ? 'success' : 'warning'}>
					{demoteSummary(result, asked)}
				</Alert>
				{#if result.skipped.length}
					<div>
						<p class="mb-1 text-sm font-semibold">Не перенесены:</p>
						<ul class="list-inside list-disc text-sm text-base-content/70">
							{#each result.skipped as skip (skip.slug)}
								<li>{titles[skip.slug] ?? skip.slug} — {skipReason(skip.reason)}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
			<div class="modal-action">
				<button type="button" class="btn" onclick={close}>Готово</button>
			</div>
		{:else}
			<div class="mt-4"><Alert kind="warning">{DEMOTE_WARNING}</Alert></div>
			<p class="mt-3 text-sm text-base-content/60">
				Фильм пропадёт с сайта, из поиска и статики. Фильмы с оценками, рецензиями и другими данными
				пользователей не переносятся.
			</p>
			{#if error}<div class="mt-3"><Alert>{error}</Alert></div>{/if}
			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={close} disabled={busy}>Отмена</button>
				<button type="button" class="btn btn-warning" onclick={demote} disabled={busy}>
					{#if busy}<span class="loading loading-xs loading-spinner"></span>{/if}
					В архив
				</button>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop"><button disabled={busy}>Закрыть</button></form>
</dialog>
