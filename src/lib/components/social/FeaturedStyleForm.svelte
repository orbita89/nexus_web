<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import {
		adminSetFeatured,
		featuredAdminError,
		validationField,
		type FeaturedOptions
	} from '#lib/social/collections.ts';
	import CollectionBackdrop from '#lib/components/social/CollectionBackdrop.svelte';
	import { FEATURED_THEMES, styleUrlError, themeById } from '#lib/social/featuredThemes.ts';
	import type { FeaturedThemeId } from '#lib/social/featuredThemes.ts';

	// Оформление особой коллекции: обои, обложка, тема. Сохраняется PUT …/featured только с
	// изменёнными полями; пустое поле — null (убрать). Используется на странице и в «Подборках».
	let {
		collection,
		compact = false,
		onsaved
	}: {
		collection: SchemaCollection;
		compact?: boolean;
		onsaved?: (c: SchemaCollection) => void;
	} = $props();

	type Field = 'wallpaper_url' | 'cover_url' | 'theme';
	const initial = $derived({
		wallpaper_url: collection.wallpaper_url ?? '',
		cover_url: collection.cover_url ?? '',
		theme: collection.theme ?? ''
	});
	// Черновики: новые данные коллекции (после сохранения) их сбрасывают.
	let wp = $derived(initial.wallpaper_url);
	let cv = $derived(initial.cover_url);
	let th = $derived(initial.theme);
	const draft = $derived<Record<Field, string>>({ wallpaper_url: wp, cover_url: cv, theme: th });

	let busy = $state(false);
	let error = $state('');
	let fieldErrors = $state<Partial<Record<Field, string>>>({});
	const uid = $props.id();

	const local = $derived({
		wallpaper_url: styleUrlError(draft.wallpaper_url),
		cover_url: styleUrlError(draft.cover_url)
	});
	const changed = $derived(
		(['wallpaper_url', 'cover_url', 'theme'] as const).filter((f) => draft[f].trim() !== initial[f])
	);
	const hasStyle = $derived(!!(initial.wallpaper_url || initial.cover_url || initial.theme));
	const knownTheme = $derived(FEATURED_THEMES.some((t) => t.id === draft.theme));
	const preview = $derived(themeById((draft.theme || null) as FeaturedThemeId | null));

	async function send(body: FeaturedOptions) {
		busy = true;
		error = '';
		fieldErrors = {};
		try {
			const updated = await adminSetFeatured(api, collection.id, body);
			onsaved?.(updated);
		} catch (e) {
			const field = validationField(e) as Field | null;
			if (field && field in initial) fieldErrors = { [field]: 'Неверное значение — проверьте.' };
			else error = featuredAdminError(e, errorMessage);
		} finally {
			busy = false;
		}
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (local.wallpaper_url || local.cover_url || !changed.length) return;
		const body: FeaturedOptions = {};
		for (const f of changed) body[f] = draft[f].trim() || null;
		void send(body);
	}

	const reset = () => send({ wallpaper_url: null, cover_url: null, theme: null });
</script>

<form class="flex w-full flex-col gap-2" onsubmit={save}>
	<div class="flex flex-wrap items-start gap-2">
		<label class="form-control min-w-48 flex-1">
			<span class="label-text text-xs">Обои (широкий фон шапки, https)</span>
			<input
				type="url"
				class={['input-bordered input w-full', compact ? 'input-xs' : 'input-sm']}
				class:input-error={!!(local.wallpaper_url || fieldErrors.wallpaper_url)}
				placeholder="https://…"
				maxlength="2048"
				disabled={busy}
				aria-describedby="{uid}-wp"
				bind:value={wp}
			/>
			<span id="{uid}-wp" class="text-xs text-error"
				>{local.wallpaper_url ?? fieldErrors.wallpaper_url ?? ''}</span
			>
		</label>
		<label class="form-control min-w-48 flex-1">
			<span class="label-text text-xs">Обложка (карточка и превью ссылки, https)</span>
			<input
				type="url"
				class={['input-bordered input w-full', compact ? 'input-xs' : 'input-sm']}
				class:input-error={!!(local.cover_url || fieldErrors.cover_url)}
				placeholder="https://…"
				maxlength="2048"
				disabled={busy}
				aria-describedby="{uid}-cv"
				bind:value={cv}
			/>
			<span id="{uid}-cv" class="text-xs text-error"
				>{local.cover_url ?? fieldErrors.cover_url ?? ''}</span
			>
		</label>
		<label class="form-control">
			<span class="label-text text-xs">Тема</span>
			<select
				class={['select-bordered select', compact ? 'select-xs' : 'select-sm']}
				class:select-error={!!fieldErrors.theme}
				disabled={busy}
				bind:value={th}
			>
				<option value="">Без темы</option>
				{#each FEATURED_THEMES as t (t.id)}
					<option value={t.id}>{t.label}</option>
				{/each}
				{#if draft.theme && !knownTheme}
					<option value={draft.theme}>{draft.theme} (неизвестная)</option>
				{/if}
			</select>
			<span class="text-xs text-error">{fieldErrors.theme ?? ''}</span>
		</label>
	</div>
	<!-- Предпросмотр: обои с затемнением поверх темы, рядом обложка. -->
	<div class="flex items-stretch gap-2">
		<div
			class="relative isolate h-16 flex-1 overflow-hidden rounded-box bg-linear-to-br ring-1 {preview.gradient} {preview.ring}"
			aria-label="Предпросмотр шапки"
		>
			{#if draft.wallpaper_url && !local.wallpaper_url}
				<img
					src={draft.wallpaper_url}
					alt=""
					class="absolute inset-0 -z-20 h-full w-full object-cover"
				/>
				<div
					class="absolute inset-0 -z-10 bg-linear-to-r from-base-100 via-base-100/80 to-base-100/20"
				></div>
			{:else if preview.pattern}
				<div class="absolute inset-0 -z-10" style:background={preview.pattern}></div>
			{/if}
			<span class="absolute bottom-1.5 left-2 text-sm font-black">{collection.title}</span>
		</div>
		<div
			class="relative isolate h-16 w-24 shrink-0 overflow-hidden rounded-box bg-base-100 ring-1 ring-base-content/10"
			aria-label="Предпросмотр фона страницы"
			title="Фон страницы"
		>
			<CollectionBackdrop
				preview
				themeId={knownTheme ? (draft.theme as FeaturedThemeId) : null}
				wallpaperUrl={draft.wallpaper_url && !local.wallpaper_url ? draft.wallpaper_url : null}
			/>
		</div>
		{#if draft.cover_url && !local.cover_url}
			<img
				src={draft.cover_url}
				alt="Предпросмотр обложки"
				class="aspect-video h-16 rounded-box object-cover"
			/>
		{/if}
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<button
			type="submit"
			class={['btn', compact ? 'btn-xs' : 'btn-sm']}
			disabled={busy || !changed.length || !!local.wallpaper_url || !!local.cover_url}
			>Сохранить оформление</button
		>
		<button
			type="button"
			class={['btn btn-ghost', compact ? 'btn-xs' : 'btn-sm']}
			disabled={busy || !hasStyle}
			onclick={reset}>Сбросить</button
		>
		{#if error}<span class="text-sm text-error" role="alert">{error}</span>{/if}
	</div>
</form>
