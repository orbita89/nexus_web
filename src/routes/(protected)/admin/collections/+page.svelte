<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import {
		adminSetFeatured,
		adminUnsetFeatured,
		featuredAdminError,
		getFeaturedCollections,
		moveItem
	} from '#lib/social/collections.ts';

	// Подборки (особые коллекции): порядок на главной. Каждое изменение — отдельный PUT с position.
	let list = $state<SchemaCollection[]>([]);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let dragFrom = $state<number | null>(null);

	async function load() {
		try {
			list = await getFeaturedCollections(api);
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
			await adminSetFeatured(api, item.id, to + 1);
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
	Особые коллекции на главной. Перетащите строку или впишите позицию. Сделать коллекцию особой можно
	на её странице.
</p>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

{#if loading}
	<span class="loading loading-spinner"></span>
{:else if !list.length}
	<p class="text-base-content/60">Особых коллекций пока нет.</p>
{:else}
	<ol class="space-y-2" aria-busy={busy}>
		{#each list as c, i (c.id)}
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
				<a
					href="/collections/{c.id}"
					class="min-w-0 flex-1 truncate font-semibold hover:text-primary">{c.title}</a
				>
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
