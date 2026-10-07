<script lang="ts" module>
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import type { MetadataForm } from '#lib/admin/entity-form.ts';

	export interface EntityFields {
		kind: SchemaEntityKind;
		slug: string;
		title: string;
		original_title: string;
		release_date: string;
		description: string;
		cover_url: string;
		metadata: MetadataForm;
		tags: string[];
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaMetadata, SchemaTagWithCount } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import {
		detectProvider,
		emptyMetadataForm,
		metadataError,
		toMetadata,
		TRAILER_LIMIT,
		WITH_TRAILERS
	} from '#lib/admin/entity-form.ts';
	import { slugError, slugify } from '#lib/admin/slug.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// Произведение: создание (тип выбирается) и правка (тип не меняется — так в API).
	let {
		initial,
		kind: initialKind = 'movie',
		submitLabel,
		onsubmit
	}: {
		initial?: EntityFields;
		kind?: SchemaEntityKind;
		submitLabel: string;
		onsubmit: (body: {
			kind: SchemaEntityKind;
			slug: string;
			title: string;
			original_title: string | null;
			release_date: string | null;
			description: string | null;
			cover_url: string | null;
			metadata: SchemaMetadata;
			tags: string[];
		}) => Promise<string | null>;
	} = $props();

	const start = (): EntityFields =>
		initial ?? {
			kind: initialKind,
			slug: '',
			title: '',
			original_title: '',
			release_date: '',
			description: '',
			cover_url: '',
			metadata: emptyMetadataForm(),
			tags: []
		};
	const isEdit = () => !!initial;
	let form = $state(start());
	let slugTouched = $state(isEdit());
	let busy = $state(false);
	let error = $state('');

	let allTags = $state<SchemaTagWithCount[]>([]);
	onMount(async () => {
		allTags = (await unwrap(guestApi.catalog.GET('/api/v1/catalog/tags')).catch(() => [])).toSorted(
			(a, b) => a.name.localeCompare(b.name, 'ru')
		);
	});

	// slug сам: из оригинального названия (Dune → dune-2021), иначе из русского.
	function autoSlug() {
		if (slugTouched) return;
		form.slug = slugify(
			form.original_title.trim() || form.title,
			form.release_date.slice(0, 4) || null
		);
	}

	function onTrailerInput(i: number) {
		const provider = detectProvider(form.metadata.trailers[i].id);
		if (provider) form.metadata.trailers[i].provider = provider;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const title = form.title.trim();
		const slug = form.slug.trim();
		const cover = form.cover_url.trim();
		error =
			(!title && 'Введите название.') ||
			slugError(slug) ||
			(cover && !/^https?:\/\//.test(cover) ? 'Обложка — ссылка http(s)://' : null) ||
			metadataError(form.kind, form.metadata) ||
			'';
		if (error) return;
		busy = true;
		error =
			(await onsubmit({
				kind: form.kind,
				slug,
				title,
				original_title: form.original_title.trim() || null,
				release_date: form.release_date || null,
				description: form.description.trim() || null,
				cover_url: cover || null,
				metadata: toMetadata(form.kind, form.metadata),
				tags: form.tags
			})) ?? '';
		busy = false;
	}
</script>

<form class="grid gap-6 lg:grid-cols-[1fr_12rem]" onsubmit={submit} aria-label="Произведение">
	<div class="flex min-w-0 flex-col gap-4">
		{#if !isEdit()}
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Тип</legend>
				<div class="join" role="radiogroup" aria-label="Тип">
					{#each KINDS as k (k.kind)}
						<label class={['btn join-item btn-sm', { 'btn-primary': form.kind === k.kind }]}>
							<input
								type="radio"
								class="hidden"
								name="kind"
								value={k.kind}
								bind:group={form.kind}
							/>
							{k.one}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<div class="grid gap-4 sm:grid-cols-2">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Название</legend>
				<input
					class="input w-full"
					name="title"
					required
					bind:value={form.title}
					oninput={autoSlug}
				/>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Оригинальное название</legend>
				<input
					class="input w-full"
					name="original_title"
					bind:value={form.original_title}
					oninput={autoSlug}
				/>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Дата выхода</legend>
				<input
					class="input w-full"
					type="date"
					name="release_date"
					bind:value={form.release_date}
					oninput={autoSlug}
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
			</fieldset>
		</div>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Описание</legend>
			<textarea class="textarea min-h-28 w-full" name="description" bind:value={form.description}
			></textarea>
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Обложка (ссылка https://)</legend>
			<input class="input w-full" type="url" name="cover_url" bind:value={form.cover_url} />
		</fieldset>

		<fieldset class="fieldset rounded-box bg-base-200 p-4 ring-1 ring-base-300">
			<legend class="fieldset-legend">Поля: {KINDS.find((k) => k.kind === form.kind)?.one}</legend>
			<div class="grid gap-3 sm:grid-cols-2">
				{#if form.kind === 'movie'}
					<label class="floating-label"
						><span>Длительность, мин</span><input
							class="input w-full"
							inputmode="numeric"
							placeholder="Длительность, мин"
							bind:value={form.metadata.runtime_min}
						/></label
					>
					<label class="floating-label"
						><span>Возрастной рейтинг</span><input
							class="input w-full"
							placeholder="Возрастной рейтинг (PG-13, 16+)"
							bind:value={form.metadata.age_rating}
						/></label
					>
				{:else if form.kind === 'series'}
					<label class="floating-label"
						><span>Сезоны</span><input
							class="input w-full"
							inputmode="numeric"
							placeholder="Сезоны"
							bind:value={form.metadata.seasons}
						/></label
					>
					<label class="floating-label"
						><span>Эпизоды</span><input
							class="input w-full"
							inputmode="numeric"
							placeholder="Эпизоды"
							bind:value={form.metadata.episodes}
						/></label
					>
					<label class="select w-full">
						<span class="label">Статус</span>
						<select bind:value={form.metadata.status}>
							<option value="">—</option>
							<option value="ongoing">Идёт</option>
							<option value="ended">Завершён</option>
							<option value="canceled">Закрыт</option>
						</select>
					</label>
				{:else if form.kind === 'book'}
					<label class="floating-label"
						><span>ISBN</span><input
							class="input w-full"
							placeholder="ISBN"
							bind:value={form.metadata.isbn}
						/></label
					>
					<label class="floating-label"
						><span>Страниц</span><input
							class="input w-full"
							inputmode="numeric"
							placeholder="Страниц"
							bind:value={form.metadata.pages}
						/></label
					>
					<label class="floating-label"
						><span>Издатель</span><input
							class="input w-full"
							placeholder="Издатель"
							bind:value={form.metadata.publisher}
						/></label
					>
				{:else}
					<label class="floating-label"
						><span>Платформы</span><input
							class="input w-full"
							placeholder="Платформы: pc, ps5, switch"
							bind:value={form.metadata.platforms}
						/></label
					>
					<label class="floating-label"
						><span>Разработчик</span><input
							class="input w-full"
							placeholder="Разработчик"
							bind:value={form.metadata.developer}
						/></label
					>
					<label class="floating-label"
						><span>Издатель</span><input
							class="input w-full"
							placeholder="Издатель"
							bind:value={form.metadata.publisher}
						/></label
					>
				{/if}
				{#if form.kind === 'movie' || form.kind === 'series'}
					<label class="floating-label"
						><span>Страны</span><input
							class="input w-full"
							placeholder="Страны: US, GB"
							bind:value={form.metadata.countries}
						/></label
					>
				{/if}
			</div>

			{#if WITH_TRAILERS.includes(form.kind)}
				<p class="mt-4 text-sm font-semibold">Трейлеры — по приоритету</p>
				<p class="text-xs text-base-content/50">
					Первый доступный зрителю покажется на карточке. Можно вставить ссылку на видео — провайдер
					определится сам.
				</p>
				<ol class="mt-2 flex flex-col gap-2" aria-label="Трейлеры">
					{#each form.metadata.trailers as trailer, i (i)}
						<li class="flex gap-2">
							<label class="select w-32 shrink-0 select-sm">
								<span class="sr-only">Провайдер трейлера {i + 1}</span>
								<select bind:value={trailer.provider}>
									<option value="youtube">YouTube</option>
									<option value="rutube">Rutube</option>
								</select>
							</label>
							<label class="input w-full input-sm">
								<span class="sr-only">Трейлер {i + 1}: id или ссылка</span>
								<input
									placeholder="id или ссылка"
									bind:value={trailer.id}
									oninput={() => onTrailerInput(i)}
								/>
							</label>
							<button
								type="button"
								class="btn btn-square btn-ghost btn-sm"
								aria-label="Убрать трейлер {i + 1}"
								onclick={() => form.metadata.trailers.splice(i, 1)}>✕</button
							>
						</li>
					{/each}
				</ol>
				{#if form.metadata.trailers.length < TRAILER_LIMIT}
					<button
						type="button"
						class="btn mt-2 w-fit btn-ghost btn-sm"
						onclick={() => form.metadata.trailers.push({ provider: 'youtube', id: '' })}
						>＋ Трейлер</button
					>
				{/if}
			{/if}
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Теги</legend>
			<div class="flex flex-wrap gap-2" role="group" aria-label="Теги">
				{#each allTags as tag (tag.slug)}
					<label
						class={[
							'badge cursor-pointer gap-1 badge-lg transition-colors',
							form.tags.includes(tag.slug) ? 'badge-primary' : 'border-base-300 bg-base-200'
						]}
					>
						<input type="checkbox" class="hidden" value={tag.slug} bind:group={form.tags} />
						{tag.name}
					</label>
				{/each}
			</div>
		</fieldset>

		{#if error}<Alert>{error}</Alert>{/if}
		<div><button class="btn btn-primary" disabled={busy}>{submitLabel}</button></div>
	</div>

	<div class="flex flex-col gap-2">
		<p class="text-xs text-base-content/50">Превью в сетке</p>
		<Poster
			title={form.title || 'Название'}
			kind={form.kind}
			coverUrl={form.cover_url.trim() || null}
		/>
	</div>
</form>
