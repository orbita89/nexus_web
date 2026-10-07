<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaCollectionItem } from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { asKind, kindByApi } from '#lib/catalog/kinds.ts';
	import { COLLECTION_LIMITS, moveItem } from '#lib/social/collections.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import EntityPicker, { type PickedEntity } from './EntityPicker.svelte';

	// Владелец правит содержимое: добавить поиском, заметка, убрать, порядок — перетаскиванием
	// или стрелками (телефон, клавиатура). Каждое действие сохраняется сразу.
	let {
		collectionId,
		items,
		onchange
	}: { collectionId: string; items: SchemaCollectionItem[]; onchange: () => void } = $props();

	// Порядок держим локально, чтобы перетаскивание не ждало сервер; новые данные — заново.
	let order = $derived([...items]);

	let error = $state('');
	let busy = $state(false);
	let dragging = $state<number | null>(null);
	let over = $state<number | null>(null);
	let noteFor = $state<string | null>(null);
	let noteDraft = $state('');
	let picked = $state<PickedEntity[]>([]);

	const path = $derived({ id: collectionId });
	const kindName = (kind: string) => {
		const k = asKind(kind);
		return k ? kindByApi(k).one : '';
	};

	async function run(action: () => Promise<unknown>) {
		busy = true;
		error = '';
		try {
			await action();
			onchange();
		} catch (e) {
			error = errorMessage(e);
			order = [...items];
		} finally {
			busy = false;
		}
	}

	function reorder(from: number, to: number) {
		if (from === to) return;
		order = moveItem(order, from, to);
		const entities = order.map((i) => i.entity.slug);
		return run(() =>
			unwrap(
				api.social.PUT('/api/v1/social/collections/{id}/items', {
					params: { path },
					body: { entities }
				})
			)
		);
	}

	const remove = (slug: string) =>
		run(() =>
			unwrap(
				api.social.DELETE('/api/v1/social/collections/{id}/items/{slug}', {
					params: { path: { id: collectionId, slug } }
				})
			)
		);

	function saveNote(event: SubmitEvent, slug: string) {
		event.preventDefault();
		const note = noteDraft.trim() || null;
		noteFor = null;
		return run(() =>
			unwrap(
				api.social.PUT('/api/v1/social/collections/{id}/items/{slug}', {
					params: { path: { id: collectionId, slug } },
					body: { note }
				})
			)
		);
	}

	// Выбранное в поиске сразу добавляется в конец коллекции.
	$effect(() => {
		const entity = picked[0];
		if (!entity) return;
		picked = [];
		if (order.some((i) => i.entity.slug === entity.slug)) return;
		void run(() =>
			unwrap(
				api.social.PUT('/api/v1/social/collections/{id}/items/{slug}', {
					params: { path: { id: collectionId, slug: entity.slug } },
					body: {}
				})
			)
		);
	});
</script>

<div class="flex flex-col gap-4">
	{#if order.length < COLLECTION_LIMITS.items}
		<div>
			<p class="mb-2 text-sm font-semibold">Добавить произведение</p>
			<EntityPicker bind:selected={picked} hint={false} />
		</div>
	{/if}
	{#if error}<Alert>{error}</Alert>{/if}

	<ol class="flex flex-col gap-2" aria-label="Содержимое коллекции">
		{#each order as item, i (item.entity.slug)}
			<li
				draggable="true"
				ondragstart={(e) => {
					dragging = i;
					e.dataTransfer?.setData('text/plain', item.entity.slug);
				}}
				ondragover={(e) => {
					e.preventDefault();
					over = i;
				}}
				ondragleave={() => (over = over === i ? null : over)}
				ondrop={(e) => {
					e.preventDefault();
					if (dragging !== null) void reorder(dragging, i);
					dragging = over = null;
				}}
				ondragend={() => (dragging = over = null)}
				class={[
					'flex items-start gap-3 rounded-box bg-base-200 p-2 ring-1 transition',
					over === i && dragging !== i ? 'ring-primary' : 'ring-base-300',
					{ 'opacity-50': dragging === i }
				]}
			>
				<span
					class="cursor-grab self-center px-1 text-base-content/30 select-none"
					aria-hidden="true">⋮⋮</span
				>
				<div class="w-12 shrink-0">
					<Poster
						title={item.entity.title}
						kind={asKind(item.entity.kind) ?? 'movie'}
						coverUrl={item.entity.cover_url}
						small
					/>
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate font-semibold">
						{item.entity.title}
						<span class="text-xs font-normal text-base-content/40"
							>{kindName(item.entity.kind)}</span
						>
					</p>
					{#if noteFor === item.entity.slug}
						<form class="mt-1 flex flex-col gap-2" onsubmit={(e) => saveNote(e, item.entity.slug)}>
							<label class="sr-only" for="note-{item.entity.slug}">Заметка</label>
							<textarea
								id="note-{item.entity.slug}"
								class="textarea w-full textarea-sm"
								maxlength={COLLECTION_LIMITS.note}
								bind:value={noteDraft}></textarea>
							<div class="flex gap-2">
								<button class="btn btn-primary btn-xs">Сохранить</button>
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => (noteFor = null)}
									>Отмена</button
								>
							</div>
						</form>
					{:else}
						{#if item.note}<p class="mt-0.5 line-clamp-2 text-sm text-base-content/60">
								{item.note}
							</p>{/if}
						<button
							class="btn mt-1 btn-link px-0 btn-xs"
							onclick={() => {
								noteDraft = item.note ?? '';
								noteFor = item.entity.slug;
							}}>{item.note ? 'Изменить заметку' : 'Добавить заметку'}</button
						>
					{/if}
				</div>
				<div class="flex shrink-0 items-center">
					<button
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Выше: {item.entity.title}"
						disabled={busy || i === 0}
						onclick={() => reorder(i, i - 1)}>↑</button
					>
					<button
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Ниже: {item.entity.title}"
						disabled={busy || i === order.length - 1}
						onclick={() => reorder(i, i + 1)}>↓</button
					>
					<button
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Убрать: {item.entity.title}"
						disabled={busy}
						onclick={() => remove(item.entity.slug)}>✕</button
					>
				</div>
			</li>
		{/each}
	</ol>
</div>
