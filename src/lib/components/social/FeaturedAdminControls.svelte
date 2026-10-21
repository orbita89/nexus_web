<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import {
		adminSetFeatured,
		adminUnsetFeatured,
		featuredAdminError
	} from '#lib/social/collections.ts';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import { slugError, slugify } from '#lib/social/slug.ts';
	import {
		FEATURED_STYLE_SUPPORTED,
		FEATURED_THEMES,
		collectionCoverUrl,
		collectionThemeId
	} from '#lib/social/featuredThemes.ts';

	// Админ: пометить коллекцию особой («Подборки») или снять пометку. Видно только роли admin.
	let {
		collection,
		onchange
	}: { collection: SchemaCollection; onchange?: (c: SchemaCollection) => void } = $props();

	let featured = $derived(collection.is_featured);
	let busy = $state(false);
	let error = $state('');

	// Оформление (тема/обложка): поля появятся на бэкенде — пока форма выключена, запросов нет.
	let themeId = $derived(collectionThemeId(collection) ?? 'default');
	let coverUrl = $derived(collectionCoverUrl(collection) ?? '');
	let wallpaperUrl = $derived(
		((collection as { wallpaper_url?: string | null }).wallpaper_url as string | null) ?? ''
	);

	// Адрес /collections/{slug}: пусто — подставляем транслит названия.
	let slugDraft = $derived(collection.slug ?? slugify(collection.title));
	let slugInvalid = $derived(slugError(slugDraft.trim()));

	/** Адрес страницы поменялся (slug, снятие пометки) — обновить строку браузера. */
	async function syncUrl(href: string) {
		if (page.url.pathname.startsWith('/collections/') && page.url.pathname !== href) {
			await goto(href, { replaceState: true });
		}
	}

	async function saveSlug() {
		const slug = slugDraft.trim();
		if (slugInvalid || slug === collection.slug) return;
		busy = true;
		error = '';
		try {
			const updated = await adminSetFeatured(api, collection.id, { slug });
			onchange?.(updated);
			await syncUrl(buildFeaturedUrl(updated));
		} catch (e) {
			error = featuredAdminError(e, errorMessage);
		} finally {
			busy = false;
		}
	}

	async function toggle() {
		busy = true;
		error = '';
		try {
			if (featured) {
				await adminUnsetFeatured(api, collection.id);
				onchange?.({ ...collection, is_featured: false, featured_position: null, slug: null });
				await syncUrl(`/collections/${collection.id}`);
			} else {
				const updated = await adminSetFeatured(api, collection.id);
				onchange?.(updated);
				await syncUrl(buildFeaturedUrl(updated));
			}
		} catch (e) {
			error = featuredAdminError(e, errorMessage);
		} finally {
			busy = false;
		}
	}
</script>

{#if session.user?.role === 'admin'}
	<div class="flex flex-wrap items-center gap-2">
		{#if featured}
			<button type="button" class="btn btn-outline btn-sm" disabled={busy} onclick={toggle}>
				Убрать из особых
			</button>
		{:else if !collection.is_public}
			<span class="tooltip" data-tip="Сначала сделайте публичной">
				<button type="button" class="btn btn-primary btn-sm" disabled>Сделать особой</button>
			</span>
			<span class="text-xs text-base-content/60">Сначала сделайте публичной</span>
		{:else}
			<button type="button" class="btn btn-primary btn-sm" disabled={busy} onclick={toggle}>
				Сделать особой
			</button>
		{/if}
		{#if featured}
			<form
				class="flex w-full flex-wrap items-end gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					void saveSlug();
				}}
			>
				<label class="form-control min-w-56 flex-1">
					<span class="label-text text-xs">Адрес: /collections/…</span>
					<input
						class="input-bordered input font-mono input-sm"
						class:input-error={!!slugInvalid}
						maxlength="100"
						autocomplete="off"
						spellcheck="false"
						disabled={busy}
						bind:value={slugDraft}
					/>
				</label>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					disabled={busy}
					title="Транслит названия"
					onclick={() => (slugDraft = slugify(collection.title))}>Из названия</button
				>
				<button
					type="submit"
					class="btn btn-sm"
					disabled={busy || !!slugInvalid || slugDraft.trim() === collection.slug}
					>Сохранить адрес</button
				>
				{#if slugInvalid}<span class="w-full text-xs text-error">{slugInvalid}</span>{/if}
			</form>
			<fieldset
				class="flex w-full flex-wrap items-end gap-2"
				disabled={!FEATURED_STYLE_SUPPORTED || busy}
			>
				<label class="form-control">
					<span class="label-text text-xs">Тема оформления</span>
					<select class="select-bordered select select-sm" bind:value={themeId}>
						{#each FEATURED_THEMES as t (t.id)}
							<option value={t.id}>{t.label}</option>
						{/each}
					</select>
				</label>
				<label class="form-control min-w-56 flex-1">
					<span class="label-text text-xs">Обои (URL, широкий фон)</span>
					<input
						type="url"
						class="input-bordered input input-sm"
						placeholder="https://…"
						bind:value={wallpaperUrl}
					/>
				</label>
				<label class="form-control min-w-56 flex-1">
					<span class="label-text text-xs">Обложка (URL)</span>
					<input
						type="url"
						class="input-bordered input input-sm"
						placeholder="https://…"
						bind:value={coverUrl}
					/>
				</label>
				{#if !FEATURED_STYLE_SUPPORTED}
					<span class="text-xs text-base-content/60">Нужна поддержка бэкенда</span>
				{/if}
			</fieldset>
		{/if}
		{#if error}<span class="text-sm text-error" role="alert">{error}</span>{/if}
	</div>
{/if}
