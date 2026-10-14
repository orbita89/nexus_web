<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaTag } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { hasFilters, PERSON_ROLES, type CatalogFilters } from '#lib/catalog/filters.ts';
	import type { KINDS } from '#lib/catalog/kinds.ts';
	import { count, yearOf } from '#lib/catalog/labels.ts';
	import { filterUrl, type Query } from '#lib/catalog/url.ts';
	import SuggestInput, { type Suggestion } from './SuggestInput.svelte';

	// Панель фильтров раздела: название, человек (с ролью), студия, тег, год, «Искать в архиве».
	// Каждое изменение — новый адрес (фильтры в query, см. filters.ts); выбранное — плашками с ✕.
	// Новый текст, студия или человек сбрасывают порядок: выдача поиска — по релевантности.
	let {
		kind,
		filters,
		personName,
		tags
	}: {
		kind: (typeof KINDS)[number];
		filters: CatalogFilters;
		personName: string | null;
		tags: SchemaTag[];
	} = $props();

	const isMovie = $derived(kind.kind === 'movie');
	/** Роль выбирают до или после человека: без человека она просто ждёт выбора. */
	let role = $derived(filters.role ?? '');
	const roleTitle = $derived(
		PERSON_ROLES.find((r) => r.value === (filters.role ?? ''))?.title ?? 'Любая роль'
	);
	const tagName = $derived(tags.find((t) => t.slug === filters.tag)?.name ?? filters.tag);

	function apply(changes: Query, resetSort = false) {
		goto(filterUrl(page.url, resetSort ? { ...changes, sort: null } : changes), {
			reset: false
		});
	}

	function submitTitle(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		const q = String(new FormData(event.currentTarget).get('q') ?? '').trim();
		apply({ q: q || null }, q !== (filters.q ?? ''));
	}

	async function people(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/people', { params: { query: { q, limit: 8 } } })
		);
		return found.items.map((p) => ({
			value: p.slug,
			label: p.full_name,
			hint: yearOf(p.birth_date) ?? undefined
		}));
	}

	async function studios(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/studios', {
				params: { query: { q: q || undefined, kind: kind.kind, limit: 8 } }
			})
		);
		const forms = ['фильм', 'фильма', 'фильмов'] as const;
		return found.map((s) => ({ value: s.name, label: s.name, hint: count(s.count, forms) }));
	}

	interface Chip {
		label: string;
		remove: Query;
	}
	const chips = $derived.by(() => {
		const f = filters;
		const list: Chip[] = [];
		if (f.q) list.push({ label: `Название: «${f.q}»`, remove: { q: null } });
		if (f.person) {
			const who = f.role ? roleTitle : 'Человек';
			list.push({
				label: `${who}: ${personName ?? f.person}`,
				remove: { person: null, role: null }
			});
		}
		if (f.studio) list.push({ label: `Студия: ${f.studio}`, remove: { studio: null } });
		if (f.tag) list.push({ label: `Тег: ${tagName}`, remove: { tag: null } });
		if (f.year) list.push({ label: `Год: ${f.year}`, remove: { year: null } });
		if (f.archive) list.push({ label: 'В архиве', remove: { archive: null } });
		return list;
	});
</script>

<section
	class="mb-4 flex flex-col gap-3 rounded-box bg-base-200 p-3 ring-1 ring-base-300 sm:p-4"
	aria-label="Фильтры"
>
	<form method="GET" action="/{kind.slug}" onsubmit={submitTitle} class="flex gap-2" role="search">
		<!-- Без JS форма уходит обычным GET: остальные фильтры — скрытыми полями. -->
		{#each ['tag', 'year', 'studio', 'person', 'role', 'archive'] as key (key)}
			{@const value = page.url.searchParams.get(key)}
			{#if value}<input type="hidden" name={key} {value} />{/if}
		{/each}
		<label class="input min-w-0 flex-1">
			<span class="sr-only">Название</span>
			<svg
				class="size-4 opacity-50"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
			>
			<input
				type="search"
				name="q"
				value={filters.q ?? ''}
				placeholder={isMovie ? 'Название фильма или студия' : 'Название'}
			/>
		</label>
		<button class="btn btn-primary">Найти</button>
	</form>

	<div
		class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]"
	>
		<div class="flex gap-2">
			<label class="select w-36 shrink-0">
				<span class="sr-only">Роль</span>
				<select
					aria-label="Роль человека"
					bind:value={role}
					onchange={() => filters.person && apply({ role: role || null })}
				>
					{#each PERSON_ROLES as r (r.value)}<option value={r.value}>{r.title}</option>{/each}
				</select>
			</label>
			<div class="min-w-0 flex-1">
				<SuggestInput
					label="Человек"
					placeholder="Актёр, режиссёр…"
					load={people}
					onselect={(s) => apply({ person: s.value, role: role || null }, true)}
				/>
			</div>
		</div>
		<SuggestInput
			label="Студия"
			placeholder="Студия"
			load={studios}
			minLength={0}
			onselect={(s) => apply({ studio: s.value }, true)}
		/>
		<label class="select w-full">
			<span class="sr-only">Тег</span>
			<select
				aria-label="Тег"
				value={filters.tag ?? ''}
				onchange={(e) => apply({ tag: e.currentTarget.value || null })}
			>
				<option value="">Все теги</option>
				{#each tags as tag (tag.slug)}<option value={tag.slug}>{tag.name}</option>{/each}
			</select>
		</label>
		<label class="input w-full">
			<span class="sr-only">Год</span>
			<input
				type="number"
				aria-label="Год"
				value={filters.year ?? ''}
				min="1800"
				max="2100"
				placeholder="Год"
				inputmode="numeric"
				onchange={(e) => apply({ year: e.currentTarget.value || null })}
			/>
		</label>
	</div>

	{#if isMovie || chips.length}
		<div class="flex flex-wrap items-center gap-2">
			{#if isMovie}
				<label class="label mr-2 cursor-pointer text-sm text-base-content/80">
					<input
						type="checkbox"
						class="checkbox checkbox-sm checkbox-primary"
						checked={filters.archive}
						onchange={(e) => apply({ archive: e.currentTarget.checked ? '1' : null })}
					/>
					Искать в архиве
				</label>
			{/if}
			{#each chips as chip (chip.label)}
				<span class="badge gap-1 badge-soft py-3 pr-1 badge-primary">
					{chip.label}
					<button
						type="button"
						class="btn btn-circle btn-ghost btn-xs"
						aria-label="Убрать фильтр {chip.label}"
						onclick={() => apply(chip.remove)}>✕</button
					>
				</span>
			{/each}
			{#if hasFilters(filters)}
				<a href="/{kind.slug}" class="btn ml-auto btn-ghost btn-sm">Сбросить фильтры</a>
			{/if}
		</div>
	{/if}
</section>
