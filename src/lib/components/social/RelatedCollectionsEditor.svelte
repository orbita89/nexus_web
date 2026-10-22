<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import {
		RELATED_MAX,
		adminAddRelated,
		adminRemoveRelated,
		adminSetRelated,
		getRelatedCollections,
		listPublicCollections,
		moveItem,
		relatedAdminError
	} from '#lib/social/collections.ts';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';

	// Админ: «Похожие подборки», заданные вручную. Порядок — PUT {ids} целиком,
	// удаление — DELETE, добавление — PUT одной связи (и, по галочке, обратной).
	let {
		collectionId,
		onchange
	}: { collectionId: string; onchange?: (list: SchemaCollection[]) => void } = $props();

	let list = $state<SchemaCollection[]>([]);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');
	let dragFrom = $state<number | null>(null);
	let both = $state(false);

	const fail = (e: unknown) => (error = relatedAdminError(e, errorMessage));

	async function load() {
		loading = true;
		try {
			list = await getRelatedCollections(api, collectionId);
		} catch (e) {
			fail(e);
		} finally {
			loading = false;
		}
	}
	void load();

	async function run(action: () => Promise<SchemaCollection[] | void>) {
		if (busy) return;
		busy = true;
		error = '';
		notice = '';
		const prev = list;
		try {
			const res = await action();
			if (res) list = res;
			onchange?.(list);
		} catch (e) {
			list = prev;
			fail(e);
		} finally {
			busy = false;
		}
	}

	function move(from: number, to: number) {
		to = Math.max(0, Math.min(to, list.length - 1));
		if (from === to) return;
		list = moveItem(list, from, to);
		const ids = list.map((c) => c.id);
		void run(() => adminSetRelated(api, collectionId, ids));
	}

	function remove(c: SchemaCollection) {
		void run(async () => {
			await adminRemoveRelated(api, collectionId, c.id);
			return list.filter((x) => x.id !== c.id);
		});
	}

	function add(c: SchemaCollection) {
		void run(async () => {
			const res = await adminAddRelated(api, collectionId, c.id);
			if (both) {
				try {
					await adminAddRelated(api, c.id, collectionId);
				} catch (e) {
					notice = `Обратная связь не добавлена: ${relatedAdminError(e, errorMessage)}`;
				}
			}
			return res;
		});
	}

	// Поиска коллекций в API нет — листаем публичные страницами и фильтруем по названию.
	const PAGE = 20;
	let browse = $state<SchemaCollection[]>([]);
	let browseMore = $state(false);
	let browseLoading = $state(false);
	let picking = $state(false);
	let query = $state('');

	async function loadBrowse() {
		browseLoading = true;
		try {
			const items = await listPublicCollections(api, browse.length, PAGE);
			const seen = new Set(browse.map((c) => c.id));
			browse = [...browse, ...items.filter((c) => !seen.has(c.id))];
			browseMore = items.length === PAGE;
		} catch (e) {
			fail(e);
		} finally {
			browseLoading = false;
		}
	}

	function openPicker() {
		picking = !picking;
		if (picking && !browse.length) void loadBrowse();
	}

	const candidates = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const linked = new Set(list.map((c) => c.id));
		return browse.filter(
			(c) =>
				c.id !== collectionId &&
				!linked.has(c.id) &&
				(!q || c.title.toLowerCase().includes(q) || c.owner.username.toLowerCase().includes(q))
		);
	});
	const full = $derived(list.length >= RELATED_MAX);
</script>

<div class="space-y-2" aria-busy={busy}>
	<p class="text-xs text-base-content/60">
		Показываются внизу страницы вместо автоматического подбора. {list.length} из {RELATED_MAX}.
	</p>
	{#if error}<Alert>{error}</Alert>{/if}
	{#if notice}<p class="text-xs text-warning">{notice}</p>{/if}

	{#if loading}
		<span class="loading loading-sm loading-spinner"></span>
	{:else if !list.length}
		<p class="text-sm text-base-content/60">Связей нет — подборки подбираются автоматически.</p>
	{:else}
		<ol class="space-y-1">
			{#each list as c, i (c.id)}
				<li
					class="flex items-center gap-2 rounded-box bg-base-100 px-2 py-1 ring-1 ring-base-300"
					class:opacity-50={dragFrom === i}
					draggable="true"
					ondragstart={() => (dragFrom = i)}
					ondragend={() => (dragFrom = null)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						if (dragFrom !== null && !busy) move(dragFrom, i);
						dragFrom = null;
					}}
				>
					<span class="cursor-grab text-base-content/40" aria-hidden="true">⋮⋮</span>
					<span class="w-5 text-xs text-base-content/60">{i + 1}</span>
					<a
						href={buildFeaturedUrl(c)}
						target="_blank"
						class="min-w-0 flex-1 truncate text-sm hover:text-primary">{c.title}</a
					>
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						disabled={busy || i === 0}
						aria-label="Выше «{c.title}»"
						onclick={() => move(i, i - 1)}>↑</button
					>
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						disabled={busy || i === list.length - 1}
						aria-label="Ниже «{c.title}»"
						onclick={() => move(i, i + 1)}>↓</button
					>
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						disabled={busy}
						aria-label="Убрать «{c.title}»"
						onclick={() => remove(c)}>✕</button
					>
				</li>
			{/each}
		</ol>
	{/if}

	<div class="flex flex-wrap items-center gap-3">
		<button type="button" class="btn btn-xs" aria-expanded={picking} onclick={openPicker}
			>{picking ? 'Скрыть' : 'Добавить подборку'}</button
		>
		<label class="flex items-center gap-1 text-xs">
			<input type="checkbox" class="checkbox checkbox-xs" bind:checked={both} />
			Связать в обе стороны
		</label>
	</div>

	{#if picking}
		{#if full}
			<p class="text-xs text-warning">Достигнут предел — {RELATED_MAX} связей. Уберите лишнюю.</p>
		{/if}
		<input
			class="input w-full max-w-sm input-sm"
			type="search"
			placeholder="Название или @автор среди загруженных"
			aria-label="Найти публичную коллекцию"
			bind:value={query}
		/>
		<ul class="max-h-64 space-y-1 overflow-y-auto">
			{#each candidates as c (c.id)}
				<li class="flex items-center gap-2 text-sm">
					<span class="min-w-0 flex-1 truncate"
						>{c.title} <span class="text-xs text-base-content/60">@{c.owner.username}</span></span
					>
					<button
						type="button"
						class="btn btn-primary btn-xs"
						disabled={busy || full}
						onclick={() => add(c)}>Связать</button
					>
				</li>
			{/each}
		</ul>
		{#if browseLoading}
			<span class="loading loading-sm loading-spinner"></span>
		{:else if browseMore}
			<button type="button" class="btn btn-ghost btn-xs" onclick={loadBrowse}
				>Загрузить ещё коллекции</button
			>
		{:else if !candidates.length}
			<p class="text-xs text-base-content/60">Ничего не найдено.</p>
		{/if}
	{/if}
</div>
