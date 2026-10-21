<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import {
		COLLECTION_LIMITS,
		featuredAdminError,
		putCollectionItem
	} from '#lib/social/collections.ts';
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
		asAdmin = false,
		onchange
	}: {
		collectionId: string;
		slugs: string[];
		/** Админ в чужой особой — админские пути состава. */
		asAdmin?: boolean;
		onchange: () => void;
	} = $props();

	let query = $state('');
	let results = $state<SchemaEntitySummary[]>([]);
	let searching = $state(false);
	let failed = $state(false);
	let error = $state('');
	let pending = $state<string | null>(null);
	/** Только что добавленное: можно сразу написать заметку (необязательно). */
	let justAdded = $state<SchemaEntitySummary | null>(null);
	let noteDraft = $state('');
	let noteBusy = $state(false);
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

	const message = (e: unknown) => featuredAdminError(e, errorMessage);

	async function saveNote(event: SubmitEvent) {
		event.preventDefault();
		const entity = justAdded;
		const note = noteDraft.trim();
		if (!entity || !note) return void (justAdded = null);
		noteBusy = true;
		error = '';
		try {
			await putCollectionItem(api, collectionId, entity.slug, { note }, asAdmin);
			justAdded = null;
			noteDraft = '';
			onchange();
		} catch (e) {
			error = message(e);
		} finally {
			noteBusy = false;
		}
	}

	async function add(entity: SchemaEntitySummary) {
		if (inCollection(entity.slug) || pending) return;
		error = '';
		pending = entity.slug;
		added = [...added, entity.slug];
		try {
			await putCollectionItem(api, collectionId, entity.slug, {}, asAdmin);
			justAdded = entity;
			noteDraft = '';
			query = '';
			results = [];
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
	{#if justAdded}
		<form class="mt-2 flex flex-col gap-2 rounded-box bg-base-200 p-3" onsubmit={saveNote}>
			<label class="text-sm" for="added-note"
				>Добавлено: <b>{justAdded.title}</b>. Заметка (необязательно)</label
			>
			<textarea
				id="added-note"
				class="textarea w-full textarea-sm"
				rows="2"
				maxlength={COLLECTION_LIMITS.note}
				disabled={noteBusy}
				bind:value={noteDraft}></textarea>
			<div class="flex gap-2">
				<button class="btn btn-primary btn-sm" disabled={noteBusy || !noteDraft.trim()}
					>Сохранить заметку</button
				>
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (justAdded = null)}
					>Без заметки</button
				>
			</div>
		</form>
	{/if}
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
