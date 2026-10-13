<script lang="ts">
	import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
	import type { Promotions } from '#lib/admin/promote.svelte.ts';

	// «Вернуть на сайт» с подтверждением. Пока запрос идёт — загрузка, повторно не нажать.
	let { doc, promotions }: { doc: SchemaArchiveDoc; promotions: Promotions } = $props();

	let dialog = $state<HTMLDialogElement>();
	const pending = $derived(promotions.pending.has(doc.slug));

	function confirm() {
		dialog?.close();
		void promotions.promote(doc);
	}
</script>

<button
	type="button"
	class="btn btn-outline btn-primary btn-xs"
	disabled={pending}
	aria-label="Вернуть на сайт: {doc.title}"
	onclick={() => dialog?.showModal()}
>
	{#if pending}<span class="loading loading-xs loading-spinner"></span>Возвращаем…{:else}Вернуть на
		сайт{/if}
</button>

<dialog bind:this={dialog} class="modal" aria-labelledby="promote-{doc.slug}">
	<div class="modal-box">
		<h3 id="promote-{doc.slug}" class="text-lg font-bold">Вернуть «{doc.title}» на сайт?</h3>
		<p class="py-4 text-sm text-base-content/70">
			Фильм появится на сайте без описания и постера — их можно добавить в редакторе.
		</p>
		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => dialog?.close()}>Отмена</button>
			<button type="button" class="btn btn-primary" onclick={confirm}>Вернуть</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>Закрыть</button></form>
</dialog>
