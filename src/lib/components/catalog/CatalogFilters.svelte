<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaTagWithCount } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import {
		hasFilters,
		PERSON_ROLES,
		yearLabel,
		type CatalogFilters
	} from '#lib/catalog/filters.ts';
	import type { KINDS } from '#lib/catalog/kinds.ts';
	import { count, roleLabel, yearOf } from '#lib/catalog/labels.ts';
	import { filterUrl, type Query } from '#lib/catalog/url.ts';
	import SuggestInput, { type Suggestion } from './SuggestInput.svelte';
	import TitleSearch from './TitleSearch.svelte';

	// Панель фильтров: название, человек (с ролью), студия, жанр или тег, год (ровно или период),
	// «Архив» (включён по умолчанию: под выдачей — блок «Из архива»). Каждое изменение — новый адрес (фильтры в query, см. filters.ts);
	// выбранное — плашками с ✕. Новый текст, студия или человек сбрасывают порядок: выдача
	// поиска — по релевантности. На /search своё поле запроса — там панель без него.
	let {
		kind,
		path,
		filters,
		personName,
		tags,
		titleField = true,
		archiveField = !kind || kind.kind === 'movie'
	}: {
		/** Раздел; на общей странице поиска — не выбран. */
		kind?: (typeof KINDS)[number];
		/** Адрес страницы без фильтров — «Сбросить фильтры» и форма без JS. */
		path: string;
		filters: CatalogFilters;
		personName: string | null;
		tags: SchemaTagWithCount[];
		titleField?: boolean;
		archiveField?: boolean;
	} = $props();

	const YEAR_KEYS = { year: null, year_from: null, year_to: null };

	/** Роль выбирают до или после человека: без человека она просто ждёт выбора. */
	let role = $derived(filters.role ?? '');
	const roleTitle = $derived(
		PERSON_ROLES.find((r) => r.value === (filters.role ?? ''))?.title ?? 'Любая роль'
	);
	const selectedTag = $derived(tags.find((t) => t.slug === filters.tag));
	/** Год: «ровно» или «период»; переключатель только меняет поля, адрес — по вводу года. */
	let yearMode = $derived<'exact' | 'range'>(
		filters.yearFrom || filters.yearTo ? 'range' : 'exact'
	);

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

	const asYear = (raw: string) => (/^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : null);

	function setRange(edge: 'from' | 'to', raw: string) {
		let from = edge === 'from' ? asYear(raw) : (filters.yearFrom ?? null);
		let to = edge === 'to' ? asYear(raw) : (filters.yearTo ?? null);
		// «С 2010 по 2000» — тот же период: бэкенд на from > to ответил бы 400.
		if (from && to && from > to) [from, to] = [to, from];
		apply({ ...YEAR_KEYS, year_from: from, year_to: to });
	}

	// Поиск людей Meilisearch: из одинаково подходящих выше известные («брэ» — Брэд Питт).
	async function people(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/people', { params: { query: { q, limit: 8 } } })
		);
		return found.items.map((p) => ({
			value: p.slug,
			label: p.full_name,
			hint: [p.known_for && roleLabel(p.known_for), yearOf(p.birth_date)]
				.filter(Boolean)
				.join(' · ')
		}));
	}

	const FILMS = ['фильм', 'фильма', 'фильмов'] as const;

	async function studios(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/studios', {
				params: { query: { q: q || undefined, kind: kind?.kind, limit: 8 } }
			})
		);
		return found.map((s) => ({ value: s.name, label: s.name, hint: count(s.count, FILMS) }));
	}

	// Жанры и теги — одна выборка (у поиска один фильтр `tag`), но разделами. Их немного и они уже
	// загружены, поэтому сужаем список на месте; пустые (без фильмов) не предлагаем.
	const norm = (s: string) => s.toLocaleLowerCase('ru').replaceAll('ё', 'е');
	async function tagOptions(q: string): Promise<Suggestion[]> {
		const needle = norm(q.trim());
		const pick = (k: SchemaTagWithCount['kind'], group: string) =>
			tags
				.filter((t) => t.kind === k && t.entities_count && norm(t.name).includes(needle))
				.map((t) => ({
					value: t.slug,
					label: t.name,
					hint: count(t.entities_count, FILMS),
					group
				}));
		return [...pick('genre', 'Жанры'), ...pick('tag', 'Теги')];
	}

	interface Chip {
		label: string;
		remove: Query;
	}
	const chips = $derived.by(() => {
		const f = filters;
		const list: Chip[] = [];
		if (f.person) {
			const who = f.role ? roleTitle : 'Человек';
			list.push({
				label: `${who}: ${personName ?? f.person}`,
				remove: { person: null, role: null }
			});
		}
		if (f.studio) list.push({ label: `Студия: ${f.studio}`, remove: { studio: null } });
		if (f.tag) {
			const what = selectedTag?.kind === 'genre' ? 'Жанр' : 'Тег';
			list.push({ label: `${what}: ${selectedTag?.name ?? f.tag}`, remove: { tag: null } });
		}
		const years = yearLabel(f);
		if (years) list.push({ label: `Год: ${years}`, remove: YEAR_KEYS });
		return list;
	});
	const active = $derived(
		titleField ? hasFilters(filters) : hasFilters({ ...filters, q: undefined })
	);
</script>

<section
	class="mb-4 flex flex-col gap-3 rounded-box bg-base-200 p-3 ring-1 ring-base-300 sm:p-4"
	aria-label="Фильтры"
>
	{#if titleField}
		<form method="GET" action={path} onsubmit={submitTitle} class="flex gap-2" role="search">
			<!-- Без JS форма уходит обычным GET: остальные фильтры — скрытыми полями. -->
			{#each ['tag', 'year', 'year_from', 'year_to', 'studio', 'person', 'role', 'archive'] as key (key)}
				{@const value = page.url.searchParams.get(key)}
				{#if value}<input type="hidden" name={key} {value} />{/if}
			{/each}
			<div class="min-w-0 flex-1">
				<TitleSearch
					value={filters.q ?? ''}
					kind={kind?.kind}
					label="Название"
					placeholder={kind?.kind === 'movie' ? 'Название фильма или студия' : 'Название'}
				/>
			</div>
			<button class="btn btn-primary">Найти</button>
		</form>
	{/if}

	<div
		class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
	>
		<!-- Роль и человек — одно поле, как год: роль слева, имя с подсказками справа. -->
		<div class="flex w-full">
			<select
				class="select w-36 shrink-0 rounded-r-none"
				aria-label="Роль человека"
				bind:value={role}
				onchange={() => filters.person && apply({ role: role || null })}
			>
				{#each PERSON_ROLES as r (r.value)}<option value={r.value}>{r.title}</option>{/each}
			</select>
			<SuggestInput
				class="min-w-0 flex-1"
				inputClass="input w-full rounded-l-none border-l-0"
				label="Человек"
				placeholder="Актёр, режиссёр…"
				load={people}
				onselect={(s) => apply({ person: s.value, role: role || null }, true)}
			/>
		</div>
		<SuggestInput
			label="Студия"
			placeholder="Студия"
			load={studios}
			minLength={0}
			onselect={(s) => apply({ studio: s.value }, true)}
		/>
		<SuggestInput
			label="Жанр или тег"
			placeholder="Жанр или тег"
			load={tagOptions}
			minLength={0}
			onselect={(s) => apply({ tag: s.value })}
		/>
		<div class="join w-full lg:w-auto">
			<select
				class="select join-item w-28 shrink-0"
				aria-label="Год: ровно или период"
				bind:value={yearMode}
			>
				<option value="exact">Год</option>
				<option value="range">Период</option>
			</select>
			{#if yearMode === 'exact'}
				<input
					type="number"
					class="input join-item w-full lg:w-24"
					aria-label="Год"
					value={filters.year ?? ''}
					min="1800"
					max="2100"
					placeholder="Любой"
					inputmode="numeric"
					onchange={(e) => apply({ ...YEAR_KEYS, year: asYear(e.currentTarget.value) })}
				/>
			{:else}
				<input
					type="number"
					class="input join-item w-full lg:w-22"
					aria-label="Год от"
					value={filters.yearFrom ?? ''}
					min="1800"
					max="2100"
					placeholder="от"
					inputmode="numeric"
					onchange={(e) => setRange('from', e.currentTarget.value)}
				/>
				<input
					type="number"
					class="input join-item w-full lg:w-22"
					aria-label="Год до"
					value={filters.yearTo ?? ''}
					min="1800"
					max="2100"
					placeholder="до"
					inputmode="numeric"
					onchange={(e) => setRange('to', e.currentTarget.value)}
				/>
			{/if}
		</div>
	</div>

	{#if archiveField || chips.length}
		<div class="flex flex-wrap items-center gap-2">
			{#if archiveField}
				<label class="label mr-2 cursor-pointer text-sm text-base-content/80">
					<input
						type="checkbox"
						class="checkbox checkbox-sm checkbox-primary"
						checked={filters.archive}
						onchange={(e) => apply({ archive: e.currentTarget.checked ? null : '0' })}
					/>
					Архив
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
			{#if active}
				<a
					href={titleField ? path : `${path}?q=${encodeURIComponent(filters.q ?? '')}`}
					class="btn ml-auto btn-ghost btn-sm">Сбросить фильтры</a
				>
			{/if}
		</div>
	{/if}
</section>
