<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { entityHref, KINDS } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import type { PickedEntity } from '#lib/components/social/EntityPicker.svelte';

	// Поиск карточки для вставки в сообщение. Только Meilisearch: в GET /entities поиска нет.
	let { onpick, onclose }: { onpick: (href: string) => void; onclose: () => void } = $props();

	let query = $state('');
	let results = $state<PickedEntity[]>([]);
	let searching = $state(false);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let field = $state<HTMLInputElement>();

	$effect(() => field?.focus());

	const kindName = (kind: string) => KINDS.find((k) => k.kind === kind)?.one ?? kind;
	const label = (e: PickedEntity) =>
		[e.title, yearOf(e.release_date), kindName(e.kind)].filter(Boolean).join(' · ');

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
				const items = (
					await unwrap(
						guestApi.catalog.GET('/api/v1/catalog/search', { params: { query: { q, limit: 8 } } })
					)
				).items;
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
</script>

<div class="mb-2 rounded-box bg-base-300/60 p-2">
	<div class="flex items-center gap-2">
		<label class="input w-full input-xs">
			<span class="sr-only">Найти карточку</span>
			<input
				bind:this={field}
				type="search"
				placeholder="Найти фильм, сериал, книгу или игру"
				autocomplete="off"
				bind:value={query}
				oninput={onInput}
				onkeydown={(e) => e.key === 'Escape' && onclose()}
			/>
			{#if searching}<span class="loading loading-xs loading-spinner"></span>{/if}
		</label>
		<button type="button" class="btn btn-ghost btn-xs" aria-label="Закрыть" onclick={onclose}
			>✕</button
		>
	</div>
	{#if failed}
		<p class="mt-1 text-xs text-error">Поиск сейчас недоступен. Попробуйте позже.</p>
	{:else if results.length}
		<ul class="mt-1 max-h-48 overflow-y-auto" aria-label="Найденные произведения">
			{#each results as entity (entity.slug)}
				<li>
					<button
						type="button"
						class="w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-base-100"
						onclick={() => onpick(entityHref({ kind: entity.kind as 'movie', slug: entity.slug }))}
						>{label(entity)}</button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
