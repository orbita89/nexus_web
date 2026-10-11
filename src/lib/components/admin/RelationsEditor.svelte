<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type {
		SchemaEntityDetail,
		SchemaRelatedWorks,
		SchemaRelationKind
	} from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { titleWithYear } from '#lib/catalog/labels.ts';
	import EntityPicker, { type PickedEntity } from '#lib/components/social/EntityPicker.svelte';

	// Приквелы, сиквелы и ремейки произведения: текущие связи с «Убрать» и добавление — выбор вида
	// и произведения поиском. Ответ PUT — новые связи, они сразу в списке; карточку на сайте
	// бэкенд пересобирает сам.
	let {
		entity,
		onchange
	}: {
		entity: Pick<SchemaEntityDetail, 'id' | 'related'>;
		onchange: (related: SchemaRelatedWorks) => void;
	} = $props();

	const GROUPS: { key: keyof SchemaRelatedWorks; kind: SchemaRelationKind; title: string }[] = [
		{ key: 'prequels', kind: 'prequel', title: 'Приквел' },
		{ key: 'sequels', kind: 'sequel', title: 'Сиквел' },
		{ key: 'remakes', kind: 'remake', title: 'Ремейк' }
	];

	let kind = $state<SchemaRelationKind>('sequel');
	let picked = $state<PickedEntity[]>([]);
	let busy = $state(false);
	let error = $state('');

	const rows = $derived(
		GROUPS.flatMap((g) => entity.related[g.key].map((item) => ({ ...g, item })))
	);

	async function add(event: SubmitEvent) {
		event.preventDefault();
		const target = picked[0];
		if (!target?.id) return;
		busy = true;
		error = '';
		try {
			const related = await unwrap(
				api.catalog.PUT('/api/v1/catalog/admin/entities/{id}/relations', {
					params: { path: { id: entity.id } },
					body: { kind, to_id: target.id }
				})
			);
			picked = [];
			onchange(related);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function remove(toId: string, relation: SchemaRelationKind, key: keyof SchemaRelatedWorks) {
		busy = true;
		error = '';
		try {
			await unwrap(
				api.catalog.DELETE('/api/v1/catalog/admin/entities/{id}/relations/{to_id}', {
					params: { path: { id: entity.id, to_id: toId }, query: { kind: relation } }
				})
			);
			onchange({ ...entity.related, [key]: entity.related[key].filter((e) => e.id !== toId) });
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<section aria-labelledby="relations-title">
	<h2 id="relations-title" class="mb-3 text-xl font-bold">Связанные</h2>
	{#if rows.length}
		<div class="overflow-x-auto rounded-box border border-base-300">
			<table class="table table-sm" aria-label="Связанные произведения">
				<tbody>
					{#each rows as row (row.kind + row.item.id)}
						<tr>
							<td class="w-28 text-base-content/60">{row.title}</td>
							<td>
								<a href={entityHref(row.item)} class="link link-hover">{titleWithYear(row.item)}</a>
							</td>
							<td class="text-right">
								<button
									class="btn btn-ghost btn-xs"
									aria-label="Убрать связь: {row.item.title}"
									disabled={busy}
									onclick={() => remove(row.item.id, row.kind, row.key)}>Убрать</button
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="text-sm text-base-content/50">Связей нет.</p>
	{/if}

	<form class="mt-4 flex flex-col gap-3" onsubmit={add} aria-label="Добавить связь">
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Вид связи</legend>
			<select class="select w-48" bind:value={kind} aria-label="Вид связи">
				{#each GROUPS as g (g.kind)}<option value={g.kind}>{g.title}</option>{/each}
			</select>
		</fieldset>
		<EntityPicker bind:selected={picked} hint={false} max={1} />
		<div>
			<button class="btn btn-primary btn-sm" disabled={busy || !picked[0]?.id}>Связать</button>
		</div>
		{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
	</form>
</section>
