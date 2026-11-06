<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaTagWithCount } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import {
		filterSet,
		hasFilters,
		PERSON_ROLES,
		roleOptions,
		yearLabel,
		type CatalogFilters
	} from '#lib/catalog/filters.ts';
	import { kindWords, type KINDS } from '#lib/catalog/kinds.ts';
	import { countryOptions } from '#lib/catalog/countries.ts';
	import { count, countryName, roleLabel, yearOf } from '#lib/catalog/labels.ts';
	import { studioHref } from '#lib/catalog/studios.ts';
	import { filterUrl, type Query } from '#lib/catalog/url.ts';
	import { liveQuery } from '#lib/social/card-live.svelte.ts';
	import SuggestInput, { type Suggestion } from './SuggestInput.svelte';
	import TitleSearch from './TitleSearch.svelte';

	// Панель фильтров: название, человек (с ролью), студия или издатель, жанр или тег, год (ровно
	// или период), «Архив» (выключен по умолчанию; включённый — фильмы архива за фильмами сайта).
	// Набор полей и роль по умолчанию — свои у каждого раздела (filterSet): у книг вместо студии
	// издательство и роль «Автор», у игр нет титров, у фильмов роль «Актёр». Каждое
	// изменение — новый адрес (фильтры в query, см. filters.ts);
	// выбранное — плашками с ✕. Новый текст, студия или человек сбрасывают порядок: выдача
	// поиска — по релевантности. На /search своё поле запроса — там панель без него.
	let {
		kind,
		path,
		filters,
		archive,
		personName,
		tags,
		titleField = true,
		archiveField = filterSet(kind?.kind).archive
	}: {
		/** Раздел; на общей странице поиска — не выбран. */
		kind?: (typeof KINDS)[number];
		/** Адрес страницы без фильтров — «Сбросить фильтры» и форма без JS. */
		path: string;
		filters: CatalogFilters;
		/** «Архив» включён (readArchive). */
		archive: boolean;
		personName: string | null;
		tags: SchemaTagWithCount[];
		titleField?: boolean;
		archiveField?: boolean;
	} = $props();

	const YEAR_KEYS = { year: null, year_from: null, year_to: null };

	/** Набор полей раздела: что показываем и какая роль стоит заранее. */
	const set = $derived(filterSet(kind?.kind));
	const roles = $derived(roleOptions(set));
	/**
	 * Роль выбирают до или после человека. Пока человек не выбран, в списке стоит роль раздела
	 * («Актёр» у фильмов, «Автор» у книг) — её и применит выбор человека. Когда человек уже
	 * выбран, источник правды — адрес: «Любая роль» там выглядит как отсутствие `role`.
	 */
	let role = $derived(filters.person ? (filters.role ?? '') : (filters.role ?? set.defaultRole));
	const roleTitle = $derived(
		PERSON_ROLES.find((r) => r.value === (filters.role ?? ''))?.title ?? 'Любая роль'
	);
	const selectedTag = $derived(tags.find((t) => t.slug === filters.tag));
	// Год — одно поле: «2020» или «2000-2010». Селект «Год/Период» и три элемента в ряду ломали
	// строку фильтров, а период вводят редко — разделитель человек напишет сам.
	const yearValue = $derived(
		filters.year
			? String(filters.year)
			: filters.yearFrom || filters.yearTo
				? `${filters.yearFrom ?? ''}-${filters.yearTo ?? ''}`
				: ''
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

	/**
	 * Разбор поля года: «2020» — ровно; «2000-2010», «2000–2010», «2000..2010» — период. Край
	 * можно опустить: «-2010» — всё до 2010-го. Мусор фильтр не ставит.
	 */
	function setYear(raw: string) {
		const text = raw.trim();
		if (!text) return apply(YEAR_KEYS);
		const exact = asYear(text);
		if (exact) return apply({ ...YEAR_KEYS, year: exact });
		const parts = text.split(/\s*(?:-|–|—|\.\.)\s*/);
		let from = asYear(parts[0] ?? '');
		let to = asYear(parts[1] ?? '');
		// «С 2010 по 2000» — тот же период: бэкенд на from > to ответил бы 400.
		if (from && to && from > to) [from, to] = [to, from];
		apply(from || to ? { ...YEAR_KEYS, year_from: from, year_to: to } : YEAR_KEYS);
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

	/** Счётчик подсказки — словами раздела: «3 книги», а не «3 фильма». */
	const FILMS = $derived(kindWords(kind?.kind));

	async function studios(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/studios', {
				params: { query: { q: q || undefined, kind: kind?.kind, limit: 8 } }
			})
		);
		return found.map((s) => ({ value: s.name, label: s.name, hint: count(s.count, FILMS) }));
	}

	// Страны — словарь у нас (фасета у бэкенда пока нет), выдачу всё равно фильтрует Meilisearch.
	async function countryList(q: string): Promise<Suggestion[]> {
		return countryOptions(q)
			.slice(0, 10)
			.map((c) => ({ value: c.value, label: c.label, hint: c.value }));
	}

	async function museums(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/museums', {
				params: { query: { q: q || undefined, kind: kind?.kind, limit: 8 } }
			})
		);
		return found.map((m) => ({ value: m.name, label: m.name, hint: count(m.count, FILMS) }));
	}

	async function publishers(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/publishers', {
				params: { query: { q: q || undefined, kind: kind?.kind, limit: 8 } }
			})
		);
		return found.map((p) => ({ value: p.name, label: p.name, hint: count(p.count, FILMS) }));
	}

	// Жанры и теги — одна выборка (у поиска один фильтр `tag`), но разделами. В разделе предлагаем
	// только те, что есть у его типа (GET /search/tags — фасет Meilisearch): жанры фильмов не
	// должны попадать в книги. Названий в фасете нет, они из общего списка `tags`; его же счётчики
	// заменяем счётчиками раздела. Ответ кэшируем: он не зависит от введённого (в фасете slug'и,
	// а ищут по названию — на месте).
	const norm = (s: string) => s.toLocaleLowerCase('ru').replaceAll('ё', 'е');
	let kindTags: Promise<Map<string, number>> | null = null;
	let kindTagsFor: string | undefined = undefined;
	function tagsOfKind(): Promise<Map<string, number>> {
		if (!kindTags || kindTagsFor !== kind?.kind) {
			kindTagsFor = kind?.kind;
			kindTags = unwrap(
				guestApi.catalog.GET('/api/v1/catalog/search/tags', {
					params: { query: { kind: kind?.kind, limit: 50 } }
				})
			)
				.then((found) => new Map(found.map((t) => [t.slug, t.count])))
				// Поиск недоступен — остаётся общий список тегов со своими счётчиками.
				.catch(() => new Map<string, number>());
		}
		return kindTags;
	}
	async function tagOptions(q: string): Promise<Suggestion[]> {
		const needle = norm(q.trim());
		const counts = await tagsOfKind();
		const inKind = (t: SchemaTagWithCount) =>
			counts.size ? counts.has(t.slug) : !!t.entities_count;
		const pick = (k: SchemaTagWithCount['kind'], group: string) =>
			tags
				.filter((t) => t.kind === k && inKind(t) && norm(t.name).includes(needle))
				.map((t) => ({
					value: t.slug,
					label: t.name,
					hint: count(counts.get(t.slug) ?? t.entities_count, FILMS),
					group
				}));
		return [...pick('genre', 'Жанры'), ...pick('tag', 'Теги')];
	}

	interface Chip {
		label: string;
		remove: Query;
		/** Ссылка из плашки: страница студии. */
		href?: string;
	}
	// Страница выбранной студии — по slug из подсказок студий (Meilisearch): в адресе фильтра только
	// название. Нет страницы (slug null) — плашка без ссылки.
	const studioPage = liveQuery(
		() => filters.studio ?? null,
		async (name) => {
			if (!name) return null;
			const found = await unwrap(
				guestApi.catalog.GET('/api/v1/catalog/search/studios', {
					params: { query: { q: name, limit: 5 } }
				})
			);
			const slug = found.find((s) => s.name.toLowerCase() === name.toLowerCase())?.slug;
			return slug ? studioHref(slug) : null;
		}
	);
	// Название премии для плашки: в адресе только slug. Не нашлась — показываем slug.
	const awardPage = liveQuery(
		() => filters.award ?? null,
		async (slug) => {
			if (!slug) return null;
			try {
				const award = await unwrap(
					guestApi.catalog.GET('/api/v1/catalog/awards/{slug}', { params: { path: { slug } } })
				);
				return award.title;
			} catch {
				return null;
			}
		}
	);
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
		if (f.studio) {
			const href = studioPage.current?.data ?? undefined;
			list.push({ label: `Студия: ${f.studio}`, remove: { studio: null }, href });
		}
		if (f.publisher) {
			const what = set.publisherLabel === 'Издательство' ? 'Издательство' : 'Издатель';
			list.push({ label: `${what}: ${f.publisher}`, remove: { publisher: null } });
		}
		if (f.museum) {
			list.push({ label: `Музей: ${f.museum}`, remove: { museum: null } });
		}
		// Страна приходит ссылкой с карточки: в адресе код, в плашке — название.
		if (f.country) {
			list.push({ label: `Страна: ${countryName(f.country)}`, remove: { country: null } });
		}
		if (f.tag) {
			const what = selectedTag?.kind === 'genre' ? 'Жанр' : 'Тег';
			list.push({ label: `${what}: ${selectedTag?.name ?? f.tag}`, remove: { tag: null } });
		}
		if (f.award) {
			const title = awardPage.current?.data ?? f.award;
			list.push({
				label: f.awardYear ? `Премия: ${title} ${f.awardYear}` : `Премия: ${title}`,
				remove: { award: null, award_year: null },
				href: `/awards/${f.award}${f.awardYear ? `/${f.awardYear}` : ''}`
			});
		}
		const years = yearLabel(f);
		if (years) list.push({ label: `Год: ${years}`, remove: YEAR_KEYS });
		return list;
	});
	const active = $derived(
		titleField ? hasFilters(filters) : hasFilters({ ...filters, q: undefined })
	);
</script>

<!-- Тот же тонкий градиент, что у личных блоков карточки: фильтры — главный инструмент
     раздела, и блок должен читаться как один предмет, а не как россыпь полей. -->
<section class="gradient-frame mb-4 rounded-2xl" aria-label="Фильтры">
	<div class="flex flex-col gap-3 rounded-[calc(1rem-1px)] bg-base-200 p-3 sm:p-4">
		{#if titleField}
			<form method="GET" action={path} onsubmit={submitTitle} class="flex gap-2" role="search">
				<!-- Без JS форма уходит обычным GET: остальные фильтры — скрытыми полями. -->
				{#each ['tag', 'year', 'year_from', 'year_to', 'studio', 'publisher', 'museum', 'country', 'person', 'role', 'archive', 'award', 'award_year', 'awarded'] as key (key)}
					{@const value = page.url.searchParams.get(key)}
					{#if value}<input type="hidden" name={key} {value} />{/if}
				{/each}
				<!-- Лупа внутри поля: строка поиска должна читаться как поиск с первого взгляда,
				     а не как ещё одно поле фильтра рядом с остальными. -->
				<div class="relative min-w-0 flex-1">
					<svg
						class="pointer-events-none absolute top-1/2 left-3.5 z-1 size-4.5 -translate-y-1/2 text-primary"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
					</svg>
					<TitleSearch
						value={filters.q ?? ''}
						kind={kind?.kind}
						label="Название"
						class="input w-full pl-11"
						placeholder={kind?.kind === 'movie' ? 'Название фильма или студия' : 'Название'}
					/>
				</div>
				<button class="btn btn-primary">Найти</button>
			</form>
		{/if}

		<!-- Шесть равных колонок на широком экране: пара «роль + человек» занимает две, остальные
		     поля по одной — тогда всё помещается в строку и одинокое поле не повисает отдельно.
		     Уже — две колонки, на телефоне — одна. -->
		<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
			<!-- Роль и человек — одно поле, как год: роль слева, имя с подсказками справа. -->
			{#if set.roles.length}
				<!-- Роль и человек — одна пара и занимает две колонки: в одной имя сжималось до
				     «Актёр, р…», и поле становилось бесполезным. -->
				<div class="flex w-full lg:col-span-2">
					<select
						class="select w-28 shrink-0 rounded-r-none"
						aria-label="Роль человека"
						bind:value={role}
						onchange={() => filters.person && apply({ role: role || null })}
					>
						{#each roles as r (r.value)}<option value={r.value}>{r.title}</option>{/each}
					</select>
					<SuggestInput
						class="min-w-0 flex-1"
						inputClass="input w-full rounded-l-none border-l-0"
						label="Человек"
						placeholder={set.personPlaceholder}
						load={people}
						onselect={(s) => apply({ person: s.value, role: role || null }, true)}
					/>
				</div>
			{/if}
			{#if set.studio}
				<SuggestInput
					label="Студия"
					placeholder="Студия"
					load={studios}
					minLength={0}
					onselect={(s) => apply({ studio: s.value }, true)}
				/>
			{/if}
			{#if set.museum}
				<SuggestInput
					label="Музей"
					placeholder="Музей или собрание"
					load={museums}
					minLength={0}
					onselect={(s) => apply({ museum: s.value }, true)}
				/>
			{/if}
			{#if set.publisherLabel}
				<SuggestInput
					label={set.publisherLabel}
					placeholder={set.publisherLabel}
					load={publishers}
					minLength={0}
					onselect={(s) => apply({ publisher: s.value }, true)}
				/>
			{/if}
			<SuggestInput
				label="Жанр или тег"
				placeholder="Жанр или тег"
				load={tagOptions}
				minLength={0}
				onselect={(s) => apply({ tag: s.value })}
			/>
			{#if set.country}
				<SuggestInput
					label="Страна"
					placeholder="Страна"
					load={countryList}
					minLength={0}
					onselect={(s) => apply({ country: s.value })}
				/>
			{/if}
			<!-- Год — текст с цифровой клавиатурой, не number: без стрелок и смены года колёсиком.
			     Одно поле на оба случая: ровно год или период через дефис. -->
			<input
				type="text"
				class="input w-full"
				aria-label="Год или период"
				value={yearValue}
				maxlength="9"
				autocomplete="off"
				placeholder="Год / период"
				inputmode="numeric"
				onchange={(e) => setYear(e.currentTarget.value)}
			/>
		</div>

		<!-- Нижняя строка есть всегда: в ней «С наградами», архив, плашки и сброс. -->
		<div class="flex flex-wrap items-center gap-2">
			{#if archiveField}
				<label class="label mr-2 cursor-pointer text-sm text-base-content/80">
					<input
						type="checkbox"
						class="toggle toggle-primary toggle-sm"
						checked={archive}
						onchange={(e) => apply({ archive: e.currentTarget.checked ? '1' : null })}
					/>
					Архив
				</label>
			{/if}
			<!-- «С наградами» — у работы есть хотя бы одна победа (фасет Meilisearch). -->
			<label class="label mr-2 cursor-pointer text-sm text-base-content/80">
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm"
					checked={!!filters.awarded}
					onchange={(e) => apply({ awarded: e.currentTarget.checked ? '1' : null })}
				/>
				С наградами
			</label>
			{#each chips as chip (chip.label)}
				<span class="badge gap-1 badge-soft py-3 pr-1 badge-primary">
					{#if chip.href}
						<a href={chip.href} class="link link-hover" title="Страница студии">{chip.label}</a>
					{:else}
						{chip.label}
					{/if}
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
	</div>
</section>
