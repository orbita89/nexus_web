<script lang="ts" module>
	export interface PersonFields {
		slug: string;
		full_name: string;
		birth_date: string;
		photo_url: string;
		bio: string;
	}
</script>

<script lang="ts">
	import { slugError, slugify } from '#lib/admin/slug.ts';
	import Alert from '#lib/components/Alert.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';

	// Человек: создание и правка. Пустые необязательные поля уходят как null (очищают значение).
	let {
		initial,
		submitLabel,
		onsubmit
	}: {
		initial?: PersonFields;
		submitLabel: string;
		onsubmit: (body: {
			slug: string;
			full_name: string;
			birth_date: string | null;
			photo_url: string | null;
			bio: string | null;
		}) => Promise<string | null>;
	} = $props();

	const start = () =>
		initial ?? { slug: '', full_name: '', birth_date: '', photo_url: '', bio: '' };
	let form = $state(start());
	// Правим существующего — slug из имени не пересчитываем.
	const isEdit = () => !!initial;
	let slugTouched = $state(isEdit());
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const slug = form.slug.trim();
		const full_name = form.full_name.trim();
		error = (!full_name && 'Введите имя.') || slugError(slug) || '';
		if (error) return;
		busy = true;
		error =
			(await onsubmit({
				slug,
				full_name,
				birth_date: form.birth_date || null,
				photo_url: form.photo_url.trim() || null,
				bio: form.bio.trim() || null
			})) ?? '';
		busy = false;
	}
</script>

<form class="grid max-w-3xl gap-4 sm:grid-cols-[1fr_10rem]" onsubmit={submit}>
	<div class="flex flex-col gap-4">
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Имя</legend>
			<input
				class="input w-full"
				name="full_name"
				required
				bind:value={form.full_name}
				oninput={() => !slugTouched && (form.slug = slugify(form.full_name))}
			/>
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">slug</legend>
			<input
				class="input w-full font-mono"
				name="slug"
				required
				bind:value={form.slug}
				oninput={() => (slugTouched = true)}
			/>
			<p class="label">Адрес: /people/{form.slug || '…'}</p>
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Дата рождения</legend>
			<input class="input w-full" type="date" name="birth_date" bind:value={form.birth_date} />
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Фото (ссылка https://)</legend>
			<input class="input w-full" type="url" name="photo_url" bind:value={form.photo_url} />
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Биография</legend>
			<textarea class="textarea min-h-32 w-full" name="bio" bind:value={form.bio}></textarea>
		</fieldset>
		{#if error}<Alert>{error}</Alert>{/if}
		<div><button class="btn btn-primary" disabled={busy}>{submitLabel}</button></div>
	</div>
	<div class="flex flex-col items-center gap-2 sm:pt-8">
		<PersonAvatar name={form.full_name || '?'} photoUrl={form.photo_url.trim() || null} size="lg" />
		<p class="text-xs text-base-content/50">Превью</p>
	</div>
</form>
