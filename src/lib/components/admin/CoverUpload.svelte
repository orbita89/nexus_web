<script lang="ts">
	// Обложка книги: превью, кнопка «Выбрать файл» и перетаскивание файла в рамку.
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { COVER_ACCEPT, coverFileError, coverPreview, uploadCover } from '#lib/admin/cover.ts';
	import Alert from '#lib/components/Alert.svelte';

	let {
		entity,
		onchange
	}: { entity: SchemaEntityDetail; onchange: (updated: SchemaEntityDetail) => void } = $props();

	let input = $state<HTMLInputElement>();
	let busy = $state(false);
	let error = $state('');
	let done = $state(false);
	let dragging = $state(false);
	/** Метка для превью после замены: адрес тот же, а браузер помнит старую картинку. */
	let version = $state(0);

	const src = $derived(coverPreview(entity.cover_url, version));

	async function send(file: File | undefined) {
		if (!file || busy) return;
		error = '';
		done = false;
		const invalid = coverFileError(file);
		if (invalid) {
			error = invalid;
			return;
		}
		busy = true;
		try {
			const updated = await uploadCover(api, entity.id, file);
			version = Date.now();
			done = true;
			onchange(updated);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
			if (input) input.value = '';
		}
	}

	function drop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		void send(event.dataTransfer?.files[0]);
	}
</script>

<div>
	<p class="text-sm text-base-content/60">
		Файл AVIF до 10 МБ. Новая обложка заменит старую по тому же адресу; на сайте браузеры увидят её
		в течение суток.
	</p>
	<div
		role="region"
		aria-label="Перетащите файл обложки сюда"
		class={[
			'mt-3 flex flex-wrap items-center gap-4 rounded-box border-2 border-dashed p-4',
			dragging ? 'border-primary bg-primary/5' : 'border-base-300'
		]}
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={drop}
	>
		{#if src}
			<img
				{src}
				alt="Обложка «{entity.title}»"
				class="h-40 w-auto rounded object-cover shadow"
				width={entity.cover_width ?? undefined}
				height={entity.cover_height ?? undefined}
			/>
		{:else}
			<div
				class="flex h-40 w-28 items-center justify-center rounded bg-base-200 text-xs text-base-content/50"
			>
				Нет обложки
			</div>
		{/if}
		<div class="flex flex-col gap-2">
			<input
				bind:this={input}
				type="file"
				accept={COVER_ACCEPT}
				class="hidden"
				onchange={(e) => send(e.currentTarget.files?.[0])}
			/>
			<button
				type="button"
				class="btn btn-primary btn-sm"
				disabled={busy}
				onclick={() => input?.click()}
			>
				{#if busy}<span class="loading loading-sm loading-spinner"></span> Загрузка…{:else}Загрузить
					обложку{/if}
			</button>
			<span class="text-xs text-base-content/60">или перетащите файл .avif в эту рамку</span>
			{#if entity.cover_width && entity.cover_height}
				<span class="text-xs text-base-content/60"
					>{entity.cover_width} × {entity.cover_height} px</span
				>
			{/if}
		</div>
	</div>
	{#if error}<div class="mt-3"><Alert>{error}</Alert></div>{/if}
	{#if done}<div class="mt-3"><Alert kind="success">Обложка заменена.</Alert></div>{/if}
</div>
