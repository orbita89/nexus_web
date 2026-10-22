<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import FeaturedStyleForm from '#lib/components/social/FeaturedStyleForm.svelte';
	import RelatedCollectionsEditor from '#lib/components/social/RelatedCollectionsEditor.svelte';
	import {
		adminSetFeatured,
		adminUnsetFeatured,
		featuredAdminError,
		getFeaturedCollections,
		moveItem
	} from '#lib/social/collections.ts';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import { slugError, slugify } from '#lib/social/slug.ts';
	import { CollectionSearch } from '#lib/social/collection-search.svelte.ts';
	import { onDestroy } from 'svelte';

	// Подборки (особые коллекции): порядок на главной. Каждое изменение — отдельный PUT с position.
	let list = $state<SchemaCollection[]>([]);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let dragFrom = $state<number | null>(null);
	// Раскрытые «Связи» (редактор грузит связи только при открытии).
	let relOpen = $state<Record<string, boolean>>({});

	// Черновики адресов по id коллекции; нет черновика — текущий slug (или транслит названия).
	let slugDrafts = $state<Record<string, string>>({});
	const draftOf = (c: SchemaCollection) => slugDrafts[c.id] ?? c.slug ?? slugify(c.title);

	async function load() {
		try {
			list = await getFeaturedCollections(api);
			slugDrafts = {};
		} catch (e) {
			error = featuredAdminError(e, errorMessage);
		} finally {
			loading = false;
		}
	}
	void load();

	/** Позиции 1…N: переставить локально и отправить PUT с новой позицией. */
	async function move(from: number, to: number) {
		to = Math.max(0, Math.min(to, list.length - 1));
		if (from === to || busy) return;
		const item = list[from];
		const prev = list;
		list = moveItem(list, from, to);
		busy = true;
		error = '';
		try {
			await adminSetFeatured(api, item.id, { position: to + 1 });
			await load();
		} catch (e) {
			list = prev;
			error = featuredAdminError(e, errorMessage);
		} finally {
			busy = false;
		}
	}

	async function unset(c: SchemaCollection) {
		busy = true;
		error = '';
		try {
			await adminUnsetFeatured(api, c.id);
			list = list.filter((x) => x.id !== c.id);
			const prev = search.items.find((x) => x.id === c.id);
			if (prev)
				search.replace({
					...prev,
					is_featured: false,
					featured_position: null,
					slug: null,
					wallpaper_url: null,
					cover_url: null,
					theme: null,
					wallpaper_mode: 'header',
					wallpaper_dim: null,
					wallpaper_blur: 0,
					effects: true,
					accent_color: null
				});
		} catch (e) {
			error = featuredAdminError(e, errorMessage);
		} finally {
			busy = false;
		}
	}

	async function saveSlug(c: SchemaCollection) {
		const slug = draftOf(c).trim();
		if (slugError(slug) || slug === c.slug || busy) return;
		busy = true;
		error = '';
		try {
			const updated = await adminSetFeatured(api, c.id, { slug });
			list = list.map((x) => (x.id === c.id ? updated : x));
			delete slugDrafts[c.id];
		} catch (e) {
			error = featuredAdminError(e, errorMessage);
		} finally {
			busy = false;
		}
	}

	// Публичные коллекции: поиск на сервере; отсюда можно сделать коллекцию особой.
	const search = new CollectionSearch({ public: true, limit: 20 });
	onDestroy(() => search.destroy());
	void search.reload();

	async function makeFeatured(c: SchemaCollection) {
		busy = true;
		error = '';
		try {
			const updated = await adminSetFeatured(api, c.id);
			search.replace(updated);
			await load();
		} catch (e) {
			error = featuredAdminError(e, errorMessage);
		} finally {
			busy = false;
		}
	}

	function onPosition(event: Event, index: number) {
		const n = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isInteger(n) && n >= 1) void move(index, n - 1);
		else (event.currentTarget as HTMLInputElement).value = String(index + 1);
	}
</script>

<h1 class="mb-2 text-2xl font-bold">Подборки</h1>
<p class="mb-4 text-sm text-base-content/70">
	Особые коллекции на главной. Перетащите строку или впишите позицию; у каждой — свой адрес
	/collections/…. Сделать коллекцию особой можно ниже или на её странице.
</p>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

{#if loading}
	<span class="loading loading-spinner"></span>
{:else if !list.length}
	<p class="text-base-content/60">Особых коллекций пока нет.</p>
{:else}
	<ol class="space-y-2" aria-busy={busy}>
		{#each list as c, i (c.id)}
			{@const draft = draftOf(c)}
			{@const invalid = slugError(draft.trim())}
			<li
				class="flex items-center gap-3 rounded-box bg-base-200 p-3 ring-1 ring-base-300"
				class:opacity-50={dragFrom === i}
				draggable="true"
				ondragstart={() => (dragFrom = i)}
				ondragend={() => (dragFrom = null)}
				ondragover={(e) => e.preventDefault()}
				ondrop={(e) => {
					e.preventDefault();
					if (dragFrom !== null) void move(dragFrom, i);
					dragFrom = null;
				}}
			>
				<span class="cursor-grab text-base-content/40" aria-hidden="true">⋮⋮</span>
				<input
					type="number"
					min="1"
					max={list.length}
					value={i + 1}
					disabled={busy}
					aria-label="Позиция «{c.title}»"
					class="input w-16 input-sm"
					onchange={(e) => onPosition(e, i)}
				/>
				<div class="min-w-0 flex-1">
					<div class="truncate font-semibold">{c.title}</div>
					<form
						class="mt-1 flex flex-wrap items-center gap-1"
						onsubmit={(e) => {
							e.preventDefault();
							void saveSlug(c);
						}}
					>
						<span class="text-xs text-base-content/60">/collections/</span>
						<input
							class="input w-56 font-mono input-xs"
							class:input-error={!!invalid}
							maxlength="100"
							autocomplete="off"
							spellcheck="false"
							aria-label="Адрес «{c.title}»"
							disabled={busy}
							value={draft}
							oninput={(e) => (slugDrafts[c.id] = e.currentTarget.value)}
						/>
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							disabled={busy}
							onclick={() => (slugDrafts[c.id] = slugify(c.title))}>Из названия</button
						>
						<button
							type="submit"
							class="btn btn-xs"
							disabled={busy || !!invalid || draft.trim() === c.slug}>Сохранить</button
						>
						{#if invalid}<span class="w-full text-xs text-error">{invalid}</span>{/if}
					</form>
					<details class="mt-1">
						<summary class="cursor-pointer text-xs text-base-content/70">Оформление</summary>
						<div class="mt-2">
							<FeaturedStyleForm
								collection={c}
								compact
								onsaved={(u) => (list = list.map((x) => (x.id === u.id ? u : x)))}
							/>
						</div>
					</details>
					<details class="mt-1" ontoggle={(e) => (relOpen[c.id] = e.currentTarget.open)}>
						<summary class="cursor-pointer text-xs text-base-content/70">Связи</summary>
						{#if relOpen[c.id]}
							<div class="mt-2"><RelatedCollectionsEditor collectionId={c.id} /></div>
						{/if}
					</details>
				</div>
				<a href={buildFeaturedUrl(c)} class="btn btn-ghost btn-xs" target="_blank">Открыть</a>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					disabled={busy || i === 0}
					aria-label="Выше"
					onclick={() => move(i, i - 1)}>↑</button
				>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					disabled={busy || i === list.length - 1}
					aria-label="Ниже"
					onclick={() => move(i, i + 1)}>↓</button
				>
				<button
					type="button"
					class="btn btn-outline btn-xs"
					disabled={busy}
					onclick={() => unset(c)}>Убрать из особых</button
				>
			</li>
		{/each}
	</ol>
{/if}

<h2 class="mt-8 mb-2 text-xl font-bold">Публичные коллекции</h2>
<input
	class="input mb-3 w-full max-w-sm input-sm"
	type="search"
	placeholder="Название коллекции"
	aria-label="Найти публичную коллекцию"
	maxlength="200"
	value={search.query}
	oninput={(e) => search.setQuery(e.currentTarget.value)}
/>
{#if search.error}<div class="mb-3"><Alert>{search.error}</Alert></div>{/if}
<ul class="space-y-2" aria-busy={search.loading}>
	{#each search.items as c (c.id)}
		<li class="flex items-center gap-3 rounded-box bg-base-100 p-3 ring-1 ring-base-300">
			<div class="min-w-0 flex-1">
				<a href={buildFeaturedUrl(c)} class="block truncate font-semibold hover:text-primary"
					>{c.title}</a
				>
				<span class="text-xs text-base-content/60">@{c.owner.username}</span>
				<details class="mt-1" ontoggle={(e) => (relOpen['b' + c.id] = e.currentTarget.open)}>
					<summary class="cursor-pointer text-xs text-base-content/70">Связи</summary>
					{#if relOpen['b' + c.id]}
						<div class="mt-2"><RelatedCollectionsEditor collectionId={c.id} /></div>
					{/if}
				</details>
			</div>
			{#if c.is_featured || list.some((x) => x.id === c.id)}
				<span class="badge badge-sm badge-primary">Особая</span>
			{:else}
				<button
					type="button"
					class="btn btn-primary btn-xs"
					disabled={busy}
					onclick={() => makeFeatured(c)}>Сделать особой</button
				>
			{/if}
		</li>
	{/each}
</ul>
{#if search.loading}
	<span class="loading mt-3 loading-spinner"></span>
{:else if search.more}
	<button type="button" class="btn mt-3 btn-sm" onclick={() => search.loadMore()}
		>Показать ещё</button
	>
{:else if search.loaded && !search.items.length}
	<p class="text-base-content/60">
		{search.query.trim() ? 'Ничего не найдено.' : 'Публичных коллекций нет.'}
	</p>
{/if}
