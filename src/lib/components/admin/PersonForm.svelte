<script lang="ts" module>
	export interface PersonFields {
		slug: string;
		full_name: string;
		/** Имя латиницей, если отличается от full_name: по нему тоже ищут. */
		original_name: string;
		birth_date: string;
		/** Ссылки на фото, по одной в строке; первая — главная. */
		photos: string;
		bio: string;
	}

	export const MAX_PHOTOS = 20;
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
			original_name: string | null;
			birth_date: string | null;
			photos: string[];
			bio: string | null;
		}) => Promise<string | null>;
	} = $props();

	const start = () =>
		initial ?? {
			slug: '',
			full_name: '',
			original_name: '',
			birth_date: '',
			photos: '',
			bio: ''
		};
	let form = $state(start());
	// Правим существующего — slug из имени не пересчитываем.
	const isEdit = () => !!initial;
	let slugTouched = $state(isEdit());
	let busy = $state(false);
	let error = $state('');
	const urls = $derived([...new Set(form.photos.split(/\s+/).filter(Boolean))]);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const slug = form.slug.trim();
		const full_name = form.full_name.trim();
		error = (!full_name && 'Введите имя.') || slugError(slug) || '';
		if (!error && urls.length > MAX_PHOTOS) error = `Фото не больше ${MAX_PHOTOS}.`;
		if (!error && urls.some((u) => !/^https:\/\//i.test(u)))
			error = 'Ссылки на фото — только https://.';
		if (error) return;
		busy = true;
		error =
			(await onsubmit({
				slug,
				full_name,
				original_name: form.original_name.trim() || null,
				birth_date: form.birth_date || null,
				photos: urls,
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
			<legend class="fieldset-legend">Имя латиницей</legend>
			<input
				class="input w-full"
				name="original_name"
				placeholder="Denis Villeneuve"
				bind:value={form.original_name}
			/>
			<p class="label">Если отличается от имени: по нему тоже ищут.</p>
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
			<legend class="fieldset-legend">Фото (ссылки https://)</legend>
			<textarea
				class="textarea min-h-24 w-full font-mono text-xs"
				name="photos"
				placeholder="https://…/1.jpg"
				bind:value={form.photos}></textarea>
			<p class="label">
				По одной ссылке в строке, до {MAX_PHOTOS}. Первая — главное фото. Сейчас: {urls.length}.
			</p>
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Биография</legend>
			<textarea class="textarea min-h-32 w-full" name="bio" bind:value={form.bio}></textarea>
		</fieldset>
		{#if error}<Alert>{error}</Alert>{/if}
		<div><button class="btn btn-primary" disabled={busy}>{submitLabel}</button></div>
	</div>
	<div class="flex flex-col items-center gap-2 sm:pt-8">
		<PersonAvatar name={form.full_name || '?'} photoUrl={urls[0] ?? null} size="lg" />
		<p class="text-xs text-base-content/50">Превью</p>
	</div>
</form>
