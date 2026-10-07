<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntityCredit, SchemaPersonSummary } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { roleLabel, yearOf } from '#lib/catalog/labels.ts';
	import Alert from '#lib/components/Alert.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';

	// Участники произведения: добавить (поиск человека, роль, персонаж, порядок) и удалить.
	// Изменить участие API не умеет — удалить и добавить заново.
	let {
		entityId,
		credits,
		onchange
	}: { entityId: string; credits: SchemaEntityCredit[]; onchange: () => void } = $props();

	const ROLES = [
		'director',
		'actor',
		'voice_actor',
		'writer',
		'author',
		'composer',
		'creator',
		'developer',
		'producer'
	];

	let query = $state('');
	let results = $state<SchemaPersonSummary[]>([]);
	let person = $state<SchemaPersonSummary | null>(null);
	let role = $state('actor');
	let customRole = $state('');
	let character = $state('');
	let error = $state('');
	let busy = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function search() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) return void (results = []);
		timer = setTimeout(async () => {
			results = (
				await unwrap(
					api.catalog.GET('/api/v1/catalog/people', { params: { query: { q, limit: 8 } } })
				).catch(() => ({ items: [] }))
			).items;
		}, 250);
	}

	async function add(event: SubmitEvent) {
		event.preventDefault();
		if (!person) return void (error = 'Выберите человека.');
		const finalRole = role === 'other' ? customRole.trim() : role;
		if (!/^[a-z_]+$/.test(finalRole))
			return void (error = 'Роль: латиница в нижнем регистре и «_».');
		busy = true;
		error = '';
		try {
			await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/entities/{id}/credits', {
					params: { path: { id: entityId } },
					body: {
						person_id: person.id,
						role: finalRole,
						character_name: character.trim() || null,
						position: credits.length
					}
				})
			);
			person = null;
			query = character = customRole = '';
			results = [];
			onchange();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function remove(creditId: string) {
		error = '';
		try {
			await unwrap(
				api.catalog.DELETE('/api/v1/catalog/admin/entities/{id}/credits/{credit_id}', {
					params: { path: { id: entityId, credit_id: creditId } }
				})
			);
			onchange();
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<section aria-labelledby="credits-admin-title">
	<h2 id="credits-admin-title" class="mb-3 text-xl font-bold">Участники</h2>
	{#if credits.length}
		<ol class="mb-4 flex flex-col gap-1" aria-label="Участники">
			{#each credits as credit (credit.id)}
				<li class="flex items-center gap-3 rounded-box bg-base-200 px-3 py-2">
					<span class="w-6 text-right text-xs text-base-content/40 tabular-nums"
						>{credit.position}</span
					>
					<PersonAvatar
						name={credit.person.full_name}
						photoUrl={credit.person.photo_url}
						size="sm"
					/>
					<span class="min-w-0 flex-1 truncate">
						<span class="font-medium">{credit.person.full_name}</span>
						<span class="text-sm text-base-content/50">
							· {roleLabel(credit.role)}{credit.character_name
								? ` — ${credit.character_name}`
								: ''}</span
						>
					</span>
					<button
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Убрать участника {credit.person.full_name}"
						onclick={() => remove(credit.id)}>✕</button
					>
				</li>
			{/each}
		</ol>
	{/if}

	<form
		class="flex flex-col gap-3 rounded-box bg-base-200 p-4 ring-1 ring-base-300"
		onsubmit={add}
		aria-label="Добавить участника"
	>
		{#if person}
			<p class="flex items-center gap-2">
				<PersonAvatar name={person.full_name} photoUrl={person.photo_url} size="sm" />
				<b>{person.full_name}</b>
				<button type="button" class="btn btn-ghost btn-xs" onclick={() => (person = null)}
					>другой</button
				>
			</p>
		{:else}
			<div class="relative">
				<label class="input w-full input-sm">
					<span class="sr-only">Найти человека</span>
					<input
						type="search"
						placeholder="Найти человека"
						autocomplete="off"
						bind:value={query}
						oninput={search}
					/>
				</label>
				{#if results.length}
					<ul
						class="menu absolute z-20 mt-1 w-full rounded-box bg-base-200 shadow-xl ring-1 ring-base-300"
						aria-label="Найденные люди"
					>
						{#each results as p (p.id)}
							<li>
								<button type="button" onclick={() => ((person = p), (results = []))}
									>{p.full_name} {yearOf(p.birth_date) ?? ''}</button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<p class="text-xs text-base-content/50">
				Нет в каталоге — <a href="/admin/people/new" class="link">добавьте человека</a>.
			</p>
		{/if}
		<div class="flex flex-wrap gap-2">
			<label class="select w-44 select-sm">
				<span class="sr-only">Роль</span>
				<select bind:value={role}>
					{#each ROLES as r (r)}<option value={r}>{roleLabel(r)}</option>{/each}
					<option value="other">Другая…</option>
				</select>
			</label>
			{#if role === 'other'}
				<label class="input w-44 input-sm"
					><span class="sr-only">Своя роль</span><input
						placeholder="art_director"
						bind:value={customRole}
					/></label
				>
			{/if}
			{#if role === 'actor' || role === 'voice_actor'}
				<label class="input w-56 input-sm"
					><span class="sr-only">Персонаж</span><input
						placeholder="Персонаж"
						bind:value={character}
					/></label
				>
			{/if}
			<button class="btn btn-primary btn-sm" disabled={busy}>Добавить участника</button>
		</div>
		{#if error}<Alert>{error}</Alert>{/if}
	</form>
</section>
