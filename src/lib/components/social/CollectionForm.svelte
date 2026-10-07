<script lang="ts">
	import { COLLECTION_LIMITS, collectionFormError } from '#lib/social/collections.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Создание и правка коллекции. Отправку делает вызывающий (POST или PATCH).
	let {
		title = '',
		description = '',
		isPublic = true,
		submitLabel,
		compact = false,
		onsubmit,
		oncancel
	}: {
		title?: string;
		description?: string;
		isPublic?: boolean;
		submitLabel: string;
		/** Без описания — для быстрого создания в окне «В коллекцию». */
		compact?: boolean;
		onsubmit: (form: {
			title: string;
			description: string | null;
			is_public: boolean;
		}) => Promise<string | null>;
		oncancel?: () => void;
	} = $props();

	const initial = () => ({ title, description, isPublic });
	let form = $state(initial());
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = collectionFormError(form) ?? '';
		if (error) return;
		busy = true;
		error =
			(await onsubmit({
				title: form.title.trim(),
				description: form.description.trim() || null,
				is_public: form.isPublic
			})) ?? '';
		busy = false;
	}
</script>

<form class="flex flex-col gap-3" onsubmit={submit}>
	<label class="floating-label">
		<span>Название</span>
		<input
			class="input w-full"
			name="title"
			placeholder="Название"
			maxlength={COLLECTION_LIMITS.title}
			required
			bind:value={form.title}
		/>
	</label>
	{#if !compact}
		<label class="floating-label">
			<span>Описание</span>
			<textarea
				class="textarea min-h-24 w-full"
				name="description"
				placeholder="Описание (необязательно)"
				maxlength={COLLECTION_LIMITS.description}
				bind:value={form.description}></textarea>
		</label>
	{/if}
	<label class="flex cursor-pointer items-center gap-3 text-sm">
		<input type="checkbox" class="toggle toggle-sm" bind:checked={form.isPublic} />
		{form.isPublic ? 'Видна всем' : 'Личная — видна только вам'}
	</label>
	{#if error}<Alert>{error}</Alert>{/if}
	<div class="flex gap-2">
		<button class="btn btn-primary btn-sm" disabled={busy}>{submitLabel}</button>
		{#if oncancel}<button type="button" class="btn btn-ghost btn-sm" onclick={oncancel}
				>Отмена</button
			>{/if}
	</div>
</form>
