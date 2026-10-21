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
	import {
		FEATURED_THEMES,
		normalizeAccent,
		resolvePageStyle,
		styleUrlError,
		themeById,
		themeDefaultDim
	} from '#lib/social/featuredThemes.ts';
	import type { FeaturedThemeId, WallpaperMode } from '#lib/social/featuredThemes.ts';

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

	type UrlField = 'wallpaper_url' | 'cover_url' | 'theme';
	type Field =
		UrlField | 'wallpaper_mode' | 'wallpaper_dim' | 'wallpaper_blur' | 'effects' | 'accent_color';
	const initial = $derived({
		wallpaper_url: collection.wallpaper_url ?? '',
		cover_url: collection.cover_url ?? '',
		theme: collection.theme ?? '',
		wallpaper_mode: (collection.wallpaper_mode === 'page' ? 'page' : 'header') as WallpaperMode,
		wallpaper_dim: collection.wallpaper_dim ?? null,
		wallpaper_blur: collection.wallpaper_blur ?? 0,
		effects: collection.effects !== false,
		accent_color: normalizeAccent(collection.accent_color) ?? ''
	});
	// Черновики: новые данные коллекции (после сохранения) их сбрасывают.
	let wp = $derived(initial.wallpaper_url);
	let cv = $derived(initial.cover_url);
	let th = $derived(initial.theme);
	let mode = $derived(initial.wallpaper_mode);
	let dim = $derived<number | null>(initial.wallpaper_dim);
	let blur = $derived(initial.wallpaper_blur);
	let fx = $derived(initial.effects);
	let acc = $derived(initial.accent_color);
	const draft = $derived<Record<UrlField, string>>({ wallpaper_url: wp, cover_url: cv, theme: th });

	let busy = $state(false);
	let error = $state('');
	let fieldErrors = $state<Partial<Record<Field, string>>>({});
	const uid = $props.id();

	const accTrim = $derived(acc.trim().toLowerCase());
	const local = $derived({
		wallpaper_url: styleUrlError(draft.wallpaper_url),
		cover_url: styleUrlError(draft.cover_url),
		accent_color:
			accTrim && !normalizeAccent(accTrim) ? 'Нужен цвет вида #rrggbb.' : (null as string | null)
	});
	const invalid = $derived(!!(local.wallpaper_url || local.cover_url || local.accent_color));
	const changed = $derived([
		...(['wallpaper_url', 'cover_url', 'theme'] as const).filter(
			(f) => draft[f].trim() !== initial[f]
		),
		...(mode !== initial.wallpaper_mode ? (['wallpaper_mode'] as const) : []),
		...(dim !== initial.wallpaper_dim ? (['wallpaper_dim'] as const) : []),
		...(blur !== initial.wallpaper_blur ? (['wallpaper_blur'] as const) : []),
		...(fx !== initial.effects ? (['effects'] as const) : []),
		...(accTrim !== initial.accent_color ? (['accent_color'] as const) : [])
	]);
	const hasStyle = $derived(
		!!(initial.wallpaper_url || initial.cover_url || initial.theme || initial.accent_color) ||
			initial.wallpaper_mode !== 'header' ||
			initial.wallpaper_dim !== null ||
			initial.wallpaper_blur !== 0 ||
			!initial.effects
	);
	const knownTheme = $derived(FEATURED_THEMES.some((t) => t.id === draft.theme));
	const preview = $derived(themeById((draft.theme || null) as FeaturedThemeId | null));
	const previewStyle = $derived(
		resolvePageStyle({
			theme: draft.theme || null,
			wallpaper_mode: mode,
			wallpaper_dim: dim,
			wallpaper_blur: blur,
			effects: fx,
			accent_color: accTrim || null
		})
	);
	const themeDim = $derived(themeDefaultDim(knownTheme ? draft.theme : null));
	const pickerValue = $derived(normalizeAccent(accTrim) ?? '#888888');
	const wpOk = $derived(draft.wallpaper_url && !local.wallpaper_url ? draft.wallpaper_url : null);

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
		if (invalid || !changed.length) return;
		const body: FeaturedOptions = {};
		for (const f of changed) {
			if (f === 'wallpaper_url' || f === 'cover_url' || f === 'theme')
				body[f] = draft[f].trim() || null;
			else if (f === 'wallpaper_mode') body.wallpaper_mode = mode;
			else if (f === 'wallpaper_dim') body.wallpaper_dim = dim;
			else if (f === 'wallpaper_blur') body.wallpaper_blur = blur;
			else if (f === 'effects') body.effects = fx;
			else body.accent_color = normalizeAccent(accTrim);
		}
		void send(body);
	}

	const reset = () =>
		send({
			wallpaper_url: null,
			cover_url: null,
			theme: null,
			wallpaper_mode: null,
			wallpaper_dim: null,
			wallpaper_blur: null,
			effects: null,
			accent_color: null
		});
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
	<div class="flex flex-wrap items-start gap-x-4 gap-y-2">
		<fieldset class="form-control" disabled={busy}>
			<legend class="label-text text-xs">Обои</legend>
			<div class="flex gap-3 pt-1">
				<label class="flex items-center gap-1 text-sm">
					<input type="radio" class="radio radio-xs" value="header" bind:group={mode} />
					Только шапка
				</label>
				<label class="flex items-center gap-1 text-sm">
					<input type="radio" class="radio radio-xs" value="page" bind:group={mode} />
					Вся страница
				</label>
			</div>
			<span class="text-xs text-error">{fieldErrors.wallpaper_mode ?? ''}</span>
		</fieldset>
		<div class="form-control min-w-40 flex-1">
			<div class="flex items-center justify-between gap-2">
				<label class="label-text text-xs" for="{uid}-dim"
					>Затемнение: {dim ?? themeDim}%{dim === null ? ' (по теме)' : ''}</label
				>
				<label class="flex items-center gap-1 text-xs">
					<input
						type="checkbox"
						class="checkbox checkbox-xs"
						checked={dim === null}
						disabled={busy}
						onchange={(e) => (dim = e.currentTarget.checked ? null : themeDim)}
					/>
					По теме
				</label>
			</div>
			<input
				id="{uid}-dim"
				type="range"
				class="range range-xs"
				class:range-error={!!fieldErrors.wallpaper_dim}
				min="0"
				max="100"
				step="1"
				disabled={busy}
				value={dim ?? themeDim}
				oninput={(e) => (dim = Number(e.currentTarget.value))}
			/>
			<span class="text-xs text-error">{fieldErrors.wallpaper_dim ?? ''}</span>
		</div>
		<label class="form-control min-w-40 flex-1">
			<span class="label-text text-xs">Размытие: {blur} px</span>
			<input
				type="range"
				class="range range-xs"
				class:range-error={!!fieldErrors.wallpaper_blur}
				min="0"
				max="20"
				step="1"
				disabled={busy}
				bind:value={blur}
			/>
			<span class="text-xs text-error">{fieldErrors.wallpaper_blur ?? ''}</span>
		</label>
		<label class="form-control">
			<span class="label-text text-xs">Эффекты темы</span>
			<input
				type="checkbox"
				class="toggle mt-1 toggle-sm"
				class:toggle-error={!!fieldErrors.effects}
				disabled={busy}
				bind:checked={fx}
			/>
			<span class="text-xs text-error">{fieldErrors.effects ?? ''}</span>
		</label>
		<div class="form-control">
			<label class="label-text text-xs" for="{uid}-acc">Акцентный цвет</label>
			<div class="flex items-center gap-1">
				<input
					type="color"
					class="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
					aria-label="Выбрать акцентный цвет"
					disabled={busy}
					value={pickerValue}
					oninput={(e) => (acc = e.currentTarget.value.toLowerCase())}
				/>
				<input
					id="{uid}-acc"
					type="text"
					class={['input-bordered input w-24 font-mono', compact ? 'input-xs' : 'input-sm']}
					class:input-error={!!(local.accent_color || fieldErrors.accent_color)}
					placeholder="По теме"
					maxlength="7"
					disabled={busy}
					aria-describedby="{uid}-acc-err"
					bind:value={acc}
				/>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					disabled={busy || !accTrim}
					onclick={() => (acc = '')}>Сбросить</button
				>
			</div>
			<span id="{uid}-acc-err" class="text-xs text-error"
				>{local.accent_color ?? fieldErrors.accent_color ?? ''}</span
			>
		</div>
	</div>
	<!-- Предпросмотр: обои с затемнением поверх темы, рядом обложка. -->
	<div class="flex items-stretch gap-2">
		<div
			class="relative isolate h-16 flex-1 overflow-hidden rounded-box bg-linear-to-br ring-1 {preview.gradient} {preview.ring}"
			aria-label="Предпросмотр шапки"
		>
			{#if wpOk && previewStyle.mode === 'header'}
				<img
					src={wpOk}
					alt=""
					class="absolute inset-0 -z-20 h-full w-full object-cover"
					style:filter={previewStyle.blur ? `blur(${previewStyle.blur / 2}px)` : null}
				/>
				<div
					class="absolute inset-0 -z-10 bg-base-100"
					style:opacity={(previewStyle.dim / 100) * 0.6}
				></div>
				<div
					class="absolute inset-0 -z-10 bg-linear-to-r from-base-100 via-base-100/80 to-base-100/20"
				></div>
			{:else if wpOk}
				<CollectionBackdrop
					preview
					themeId={knownTheme ? (draft.theme as FeaturedThemeId) : null}
					wallpaperUrl={wpOk}
					mode="page"
					dim={previewStyle.dim}
					blur={previewStyle.blur}
					effects={previewStyle.effects}
					accent={previewStyle.accent}
				/>
			{:else if preview.pattern && previewStyle.effects}
				<div class="absolute inset-0 -z-10" style:background={preview.pattern}></div>
			{/if}
			<span class="absolute bottom-1.5 left-2 text-sm font-black"
				><span class="text-warning" style:color={previewStyle.accent}>★</span>
				{collection.title}</span
			>
		</div>
		<div
			class="relative isolate h-16 w-24 shrink-0 overflow-hidden rounded-box bg-base-100 ring-1 ring-base-content/10"
			aria-label="Предпросмотр фона страницы"
			title="Фон страницы"
		>
			<CollectionBackdrop
				preview
				themeId={knownTheme ? (draft.theme as FeaturedThemeId) : null}
				wallpaperUrl={wpOk}
				mode={previewStyle.mode}
				dim={previewStyle.dim}
				blur={previewStyle.blur}
				effects={previewStyle.effects}
				accent={previewStyle.accent}
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
			disabled={busy || !changed.length || invalid}>Сохранить оформление</button
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
