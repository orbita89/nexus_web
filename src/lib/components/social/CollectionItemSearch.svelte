<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { api, guestApi } from '#lib/auth/session.svelte.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// Быстрое добавление прямо со страницы коллекции: поиск по каталогу (только Meilisearch,
	// GET /catalog/search) и добавление в конец по клику. Правка заметок и порядка — в «Изменить содержимое».
	let {
		collectionId,
		slugs,
		onchange
	}: { collectionId: string; slugs: string[]; onchange: () => void } = $props();

	let query = $state('');
	let results = $state<SchemaEntitySummary[]>([]);
	let searching = $state(false);
	let failed = $state(false);
	let error = $state('');
	let pending = $state<string | null>(null);
	/** Добавленные, пока страница не перечиталась, — сразу помечаем «Уже в коллекции». */
	let added = $state<string[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const inCollection = (slug: string) => slugs.includes(slug) || added.includes(slug);
	const kindName = (kind: string) => KINDS.find((k) => k.kind === kind)?.one ?? kind;

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			failed = false;
			return;
		}
		timer = setTimeout(async () => {
			searching = true;
			try {
				const params = { query: { q, limit: 8 } };
				const items = (await unwrap(guestApi.catalog.GET('/api/v1/catalog/search', { params })))
					.items;
				if (q === query.trim()) results = items;
				failed = false;
			} catch {
				results = [];
				failed = true;
			} finally {
				searching = false;
			}
		}, 250);
	}

	function message(e: unknown) {
		const status = (e as { status?: number })?.status;
		return status === 403 ? 'Недостаточно прав' : errorMessage(e);
	}

	async function add(entity: SchemaEntitySummary) {
		if (inCollection(entity.slug) || pending) return;
		error = '';
		pending = entity.slug;
		added = [...added, entity.slug];
		try {
			await unwrap(
				api.social.PUT('/api/v1/social/collections/{id}/items/{slug}', {
					params: { path: { id: collectionId, slug: entity.slug } },
					body: {}
				})
			);
			onchange();
		} catch (e) {
			added = added.filter((s) => s !== entity.slug);
			error = message(e);
		} finally {
			pending = null;
		}
	}
</script>

<div class="relative mt-4 max-w-xl">
	<label class="input w-full">
		<span class="sr-only">Добавить фильм</span>
		<input
			type="search"
			placeholder="Добавить фильм, сериал, книгу или игру"
			autocomplete="off"
			bind:value={query}
			oninput={onInput}
			onkeydown={(e) => e.key === 'Escape' && ((query = ''), (results = []))}
		/>
		{#if searching}<span class="loading loading-xs loading-spinner"></span>{/if}
	</label>
	{#if failed}<p class="mt-1 text-xs text-error">Поиск сейчас недоступен. Попробуйте позже.</p>{/if}
	{#if error}<p class="mt-1 text-xs text-error" role="alert">{error}</p>{/if}
	{#if results.length}
		<ul
			class="absolute z-20 mt-1 flex max-h-96 w-full flex-col overflow-y-auto rounded-box bg-base-200 p-1 shadow-xl ring-1 ring-base-300"
			aria-label="Найденные произведения"
		>
			{#each results as entity (entity.slug)}
				{@const taken = inCollection(entity.slug)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-field p-1.5 text-left hover:bg-base-300 disabled:cursor-default disabled:hover:bg-transparent"
						disabled={taken || !!pending}
						onclick={() => add(entity)}
					>
						<span class="w-9 shrink-0">
							<Poster title={entity.title} kind={entity.kind} coverUrl={entity.cover_url} small />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-semibold">{entity.title}</span>
							<span class="text-xs text-base-content/50"
								>{[yearOf(entity.release_date), kindName(entity.kind)]
									.filter(Boolean)
									.join(' · ')}</span
							>
						</span>
						{#if pending === entity.slug}
							<span class="loading loading-xs loading-spinner"></span>
						{:else if taken}
							<span class="badge badge-ghost badge-sm">Уже в коллекции</span>
						{:else}
							<span class="text-sm text-primary">+ Добавить</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
