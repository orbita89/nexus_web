<script lang="ts">
	import { LIMITS, threadFormError } from '#lib/social/forum.ts';
	import Alert from '#lib/components/Alert.svelte';
	import EntityPicker, { type PickedEntity } from './EntityPicker.svelte';

	// Форма темы: создание и правка. Отправку делает страница (POST или PATCH).
	let {
		title = '',
		body = '',
		entities = [],
		submitLabel,
		onsubmit
	}: {
		title?: string;
		body?: string;
		entities?: PickedEntity[];
		submitLabel: string;
		onsubmit: (form: { title: string; body: string; entities: string[] }) => Promise<string | null>;
	} = $props();

	// Начальные значения — один раз, дальше форму правит пользователь.
	const initial = () => ({ title, body, entities });
	let form = $state(initial());
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = threadFormError(form) ?? '';
		if (error) return;
		busy = true;
		error =
			(await onsubmit({
				title: form.title.trim(),
				body: form.body.trim(),
				entities: form.entities.map((e) => e.slug)
			})) ?? '';
		busy = false;
	}
</script>

<form class="flex max-w-3xl flex-col gap-5" onsubmit={submit}>
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Заголовок</legend>
		<input
			class="input w-full"
			name="title"
			maxlength={LIMITS.title}
			required
			bind:value={form.title}
		/>
	</fieldset>
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Произведения</legend>
		<EntityPicker bind:selected={form.entities} />
	</fieldset>
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Текст</legend>
		<textarea
			class="textarea min-h-48 w-full"
			name="body"
			maxlength={LIMITS.threadBody}
			required
			bind:value={form.body}></textarea>
		<p class="label">Простой текст; ссылки станут кликабельными.</p>
	</fieldset>
	{#if error}<Alert>{error}</Alert>{/if}
	<div><button class="btn btn-primary" disabled={busy}>{submitLabel}</button></div>
</form>
