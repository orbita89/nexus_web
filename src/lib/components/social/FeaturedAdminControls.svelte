<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import {
		adminSetFeatured,
		adminUnsetFeatured,
		featuredAdminError
	} from '#lib/social/collections.ts';
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

	async function toggle() {
		busy = true;
		error = '';
		try {
			if (featured) {
				await adminUnsetFeatured(api, collection.id);
				onchange?.({ ...collection, is_featured: false, featured_position: null });
			} else {
				onchange?.(await adminSetFeatured(api, collection.id));
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
