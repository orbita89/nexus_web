<script lang="ts" module>
	export interface PickedEntity {
		slug: string;
		title: string;
		kind: string;
		cover_url?: string | null;
		release_date?: string | null;
	}
</script>

<script lang="ts">
	import { ApiError, unwrap } from '#lib/api/errors.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import { LIMITS } from '#lib/social/forum.ts';

	// Произведения темы: поиск по каталогу (Meilisearch; недоступен — подстрока в названии),
	// до 10 штук, первое — главное, порядок меняется стрелками.
	let {
		selected = $bindable([]),
		hint = true
	}: {
		selected: PickedEntity[];
		/** Подсказка «до 10, первое — главное» (для тем). */ hint?: boolean;
	} = $props();

	let query = $state('');
	let results = $state<PickedEntity[]>([]);
	let searching = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const kindName = (kind: string) => KINDS.find((k) => k.kind === kind)?.one ?? kind;
	const label = (e: PickedEntity) =>
		[e.title, yearOf(e.release_date), kindName(e.kind)].filter(Boolean).join(' · ');

	async function search(q: string) {
		const params = { query: { q, limit: 8 } };
		try {
			return (await unwrap(guestApi.catalog.GET('/api/v1/catalog/search', { params }))).items;
		} catch (e) {
			if (!(e instanceof ApiError && e.status === 503)) throw e;
			return (await unwrap(guestApi.catalog.GET('/api/v1/catalog/entities', { params }))).items;
		}
	}

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			return;
		}
		timer = setTimeout(async () => {
			searching = true;
			try {
				const items = await search(q);
				if (q === query.trim()) results = items;
			} catch {
				results = [];
			} finally {
				searching = false;
			}
		}, 250);
	}

	function add(entity: PickedEntity) {
		if (selected.length >= LIMITS.entities || selected.some((e) => e.slug === entity.slug)) return;
		selected = [...selected, entity];
		query = '';
		results = [];
	}

	function move(i: number, by: -1 | 1) {
		const next = [...selected];
		[next[i], next[i + by]] = [next[i + by], next[i]];
		selected = next;
	}
</script>

<div class="flex flex-col gap-3">
	{#if selected.length}
		<ol class="flex flex-col gap-2" aria-label="Выбранные произведения">
			{#each selected as entity, i (entity.slug)}
				<li class="flex items-center gap-2 rounded-box bg-base-300/60 px-3 py-2">
					<span class="min-w-0 flex-1 truncate text-sm">
						{label(entity)}
						{#if i === 0}<span class="ml-1 badge badge-sm badge-primary">главное</span>{/if}
					</span>
					<button
						type="button"
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Выше: {entity.title}"
						disabled={i === 0}
						onclick={() => move(i, -1)}>↑</button
					>
					<button
						type="button"
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Ниже: {entity.title}"
						disabled={i === selected.length - 1}
						onclick={() => move(i, 1)}>↓</button
					>
					<button
						type="button"
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Убрать: {entity.title}"
						onclick={() => (selected = selected.filter((e) => e.slug !== entity.slug))}>✕</button
					>
				</li>
			{/each}
		</ol>
	{/if}

	{#if selected.length < LIMITS.entities}
		<div class="relative">
			<label class="input w-full">
				<span class="sr-only">Найти произведение</span>
				<input
					type="search"
					placeholder="Найти фильм, сериал, книгу или игру"
					autocomplete="off"
					bind:value={query}
					oninput={onInput}
				/>
				{#if searching}<span class="loading loading-xs loading-spinner"></span>{/if}
			</label>
			{#if results.length}
				<ul
					class="menu absolute z-20 mt-1 w-full rounded-box bg-base-200 shadow-xl ring-1 ring-base-300"
					aria-label="Найденные произведения"
				>
					{#each results as entity (entity.slug)}
						{@const taken = selected.some((e) => e.slug === entity.slug)}
						<li class:menu-disabled={taken}>
							<button type="button" disabled={taken} onclick={() => add(entity)}
								>{label(entity)}</button
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
	{#if hint}
		<p class="text-xs text-base-content/50">
			До 10 произведений, первое — главное. Например, книга и её экранизации.
		</p>
	{/if}
</div>
