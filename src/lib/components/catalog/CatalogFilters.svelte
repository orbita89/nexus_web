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
	import FilterMenu, { type Suggestion } from './FilterMenu.svelte';
	import YearRange from './YearRange.svelte';
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
	/** Шкала ползунка года — та же, что в YearRange: по её краям фильтр снимается. */
	const YEAR_MIN = 1900;
	const YEAR_MAX = new Date().getFullYear();

	/** Открытая панель — всегда одна: вторая поверх первой читалась бы как сбой. */
	let openMenu = $state<string | null>(null);

	/** Общий штрих значков таблеток: один стиль на всю строку. */
	const STROKE = {
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 1.8,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round'
	} as const;

	/** Набор полей раздела: что показываем и какая роль стоит заранее. */
	const set = $derived(filterSet(kind?.kind));
	const roles = $derived(roleOptions(set));
	/**
	 * Роль — вкладка в панели «Персоналии»; источник правды — адрес. Заранее стоит роль раздела
	 * («Актёры» у фильмов, «Авторы» у книг): с неё начинают почти всегда, и панель открывается
	 * сразу с нужными лицами.
	 */
	let role = $derived(filters.role ?? set.defaultRole);

	/** Профессии во множественном числе: вкладка — про всех, а не про одного человека. */
	const PLURAL: Record<string, string> = {
		actor: 'Актёры',
		director: 'Режиссёры',
		writer: 'Сценаристы',
		producer: 'Продюсеры',
		composer: 'Композиторы',
		cinematographer: 'Операторы',
		editor: 'Монтажёры',
		author: 'Авторы',
		translator: 'Переводчики',
		illustrator: 'Иллюстраторы',
		artist: 'Художники'
	};
	/**
	 * Вкладками — три профессии, по которым ищут почти всегда; прочие убраны под «Ещё». Семь
	 * вкладок подряд читались как перечень, а не как выбор, и забирали всю ширину панели.
	 */
	const named = $derived(
		roles
			.filter((r) => r.value)
			.map((r) => ({ value: r.value as string, title: PLURAL[r.value] ?? r.title }))
	);
	const tabs = $derived(named.slice(0, 3));
	const rest = $derived(named.slice(3));
	/** Выбранная профессия из «Ещё» — её и показываем на кнопке вместо слова «Ещё». */
	const restRole = $derived(rest.find((r) => r.value === role));

	let restOpen = $state(false);
	let restRoot = $state<HTMLElement>();

	function setRole(value: string) {
		role = value;
		restOpen = false;
		// Человек уже выбран — вкладка меняет его роль прямо в выдаче.
		if (filters.person) apply({ role: value || null });
	}
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

	/**
	 * Границы с ползунка — в адрес. Край, упёртый в конец шкалы, фильтром не считаем: «с 1900»
	 * и «по этот год» — это «любой год», и в ссылке им делать нечего. Сомкнутые ручки — ровно
	 * один год (`year`), а не период из одного года.
	 */
	function setYearRange(from: number, to: number) {
		const start = from <= YEAR_MIN ? null : from;
		const end = to >= YEAR_MAX ? null : to;
		if (!start && !end) return apply(YEAR_KEYS);
		if (start && start === end) return apply({ ...YEAR_KEYS, year: start });
		apply({ ...YEAR_KEYS, year_from: start, year_to: end });
	}

	// Поиск людей Meilisearch: из одинаково подходящих выше известные («брэ» — Брэд Питт). Без
	// запроса тот же поиск отдаёт самых известных — ими и заполняем панель, чтобы открывший её
	// сразу видел лица, а не пустоту. Вкладка роли уходит в known_for.
	async function people(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/people', {
				params: { query: { q: q || undefined, known_for: role || undefined, limit: 9 } }
			})
		);
		// Профессию под именем пишем, только если она не та, что выбрана вкладкой: на вкладке
		// «Актёры» слово «Актёр» под каждым лицом — девять одинаковых строк ни о чём.
		return found.items.map((p) => ({
			value: p.slug,
			label: p.full_name,
			photoUrl: p.photo_url ?? null,
			hint: [p.known_for !== role && p.known_for && roleLabel(p.known_for), yearOf(p.birth_date)]
				.filter(Boolean)
				.join(' · ')
		}));
	}

	/** Счётчик подсказки — словами раздела: «3 книги», а не «3 фильма». */
	const FILMS = $derived(kindWords(kind?.kind));

	async function studios(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/studios', {
				params: { query: { q: q || undefined, kind: kind?.kind, limit: 9 } }
			})
		);
		return found.map((s) => ({
			value: s.name,
			label: s.name,
			hint: count(s.count, FILMS),
			logoUrl: logoOf(s)
		}));
	}

	// Флаг страны — из кода ISO: две буквы в их региональные символы. У «СССР» (SU) флага в Unicode
	// нет — там останется пустое место, и это лучше чужого флага.
	const flag = (code: string) =>
		code === 'SU'
			? ''
			: String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));

	// Страны — словарь у нас (фасета у бэкенда пока нет), выдачу всё равно фильтрует Meilisearch.
	async function countryList(q: string): Promise<Suggestion[]> {
		return countryOptions(q)
			.slice(0, 12)
			.map((c) => ({ value: c.value, label: c.label, hint: c.value, emoji: flag(c.value) }));
	}

	/**
	 * Логотип подсказки: в выдаче поиска его пока нет (`StudioHit` — название, slug и счётчик),
	 * просили добавить в docs/backend-tasks/search-studio-logo.md. Пока не приедет, карточка
	 * остаётся без картинки; читаем мягко, чтобы включилось само.
	 */
	const logoOf = (hit: object): string | null =>
		(hit as { logo_url?: string | null }).logo_url ?? null;

	async function museums(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/museums', {
				params: { query: { q: q || undefined, kind: kind?.kind, limit: 9 } }
			})
		);
		return found.map((m) => ({
			value: m.name,
			label: m.name,
			hint: count(m.count, FILMS),
			logoUrl: logoOf(m)
		}));
	}

	async function publishers(q: string): Promise<Suggestion[]> {
		const found = await unwrap(
			guestApi.catalog.GET('/api/v1/catalog/search/publishers', {
				params: { query: { q: q || undefined, kind: kind?.kind, limit: 9 } }
			})
		);
		return found.map((p) => ({
			value: p.name,
			label: p.name,
			hint: count(p.count, FILMS),
			logoUrl: logoOf(p)
		}));
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
	/** Вкладка панели: жанры или теги. Как роли у «Персоналий» — одним переключателем. */
	let tagKind = $state<SchemaTagWithCount['kind']>('genre');
	async function tagOptions(q: string): Promise<Suggestion[]> {
		const needle = norm(q.trim());
		const counts = await tagsOfKind();
		const inKind = (t: SchemaTagWithCount) =>
			counts.size ? counts.has(t.slug) : !!t.entities_count;
		// Показываем одну вкладку целиком: раньше жанры и теги шли подряд двумя разделами, и
		// теги оказывались под сгибом панели.
		return tags
			.filter((t) => t.kind === tagKind && inKind(t) && norm(t.name).includes(needle))
			.map((t) => ({
				value: t.slug,
				label: t.name,
				hint: count(counts.get(t.slug) ?? t.entities_count, FILMS)
			}));
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

<!-- Клик мимо закрывает список «Ещё»: кнопки «закрыть» у него нет. -->
<svelte:window
	onpointerdown={(e) => {
		if (restOpen && restRoot && !restRoot.contains(e.target as Node)) restOpen = false;
	}}
/>

<!-- Значки таблеток: один штрих-стиль на всю строку, чтобы кнопки читались как один набор. -->
{#snippet personIcon()}
	<svg class="size-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
		<circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" />
	</svg>
{/snippet}
{#snippet studioIcon()}
	<svg class="size-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
		<rect x="3" y="7" width="18" height="12" rx="2" /><path d="m7 7 2-3m4 3 2-3" />
	</svg>
{/snippet}
{#snippet tagIcon()}
	<svg class="size-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
		<path d="M4 4h7l9 9-7 7-9-9V4Z" /><circle cx="8.5" cy="8.5" r="1.3" />
	</svg>
{/snippet}
{#snippet countryIcon()}
	<svg class="size-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
		<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a16 16 0 0 1 0 18" />
	</svg>
{/snippet}
{#snippet yearIcon()}
	<svg class="size-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
		<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" />
	</svg>
{/snippet}

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
				<!-- Кнопки «Найти» нет: оранжевая кнопка перетягивала внимание со всей панели, а
				     ищут отсюда с клавиатуры. Отправку оставляем скрытой — без неё форма без JS не
				     уходит по Enter. -->
				<button class="sr-only" tabindex="-1">Найти</button>
			</form>
		{/if}

		<!-- Строка таблеток: каждая открывает панель во всю ширину (у строки position: relative —
		     от неё панель и растягивается). -->
		<div class="relative flex flex-wrap gap-2">
			<!-- «Персоналии»: роль выбирают вкладками в самой панели, над сеткой лиц. -->
			{#if set.roles.length}
				<FilterMenu
					label="Персоналии"
					icon={personIcon}
					active={!!filters.person && !openMenu}
					open={openMenu === 'person'}
					ontoggle={(v) => {
						openMenu = v ? 'person' : null;
						restOpen = false;
					}}
					reloadKey={role}
					load={people}
					searchPlaceholder={set.personPlaceholder}
					more={{ href: '/people', label: 'Все люди' }}
					onselect={(s) => apply({ person: s.value, role: role || null }, true)}
				>
					{#snippet header()}
						<div class="flex shrink-0 flex-wrap items-center gap-4">
							{#each tabs as tab (tab.value)}
								<button
									type="button"
									class="filter-tab"
									class:filter-tab-on={role === tab.value}
									onclick={() => setRole(tab.value)}>{tab.title}</button
								>
							{/each}
							{#if rest.length}
								<!-- «Ещё»: список прочих профессий, выпадает от своей кнопки вправо и
								     закрывается выбором или кликом мимо. -->
								<div class="relative" bind:this={restRoot}>
									<button
										type="button"
										class="filter-tab flex items-center gap-1"
										class:filter-tab-on={!!restRole}
										aria-expanded={restOpen}
										onclick={() => (restOpen = !restOpen)}
									>
										{restRole?.title ?? 'Ещё'}
										<svg
											class="size-3 opacity-60"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<path d="m6 9 6 6 6-6" />
										</svg>
									</button>
									{#if restOpen}
										<div
											class="absolute top-full left-0 z-30 mt-2 min-w-44 rounded-xl border border-base-content/10 bg-base-300 p-1 shadow-xl"
										>
											{#each rest as r (r.value)}
												<button
													type="button"
													class="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-base-content/10"
													class:text-primary={role === r.value}
													onclick={() => setRole(r.value)}>{r.title}</button
												>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/snippet}
				</FilterMenu>
			{/if}
			{#if set.studio}
				<FilterMenu
					label="Студия"
					icon={studioIcon}
					active={!!filters.studio && !openMenu}
					open={openMenu === 'studio'}
					ontoggle={(v) => (openMenu = v ? 'studio' : null)}
					load={studios}
					searchPlaceholder="Поиск студии…"
					more={{ href: '/studios', label: 'Все студии' }}
					onselect={(s) => apply({ studio: s.value }, true)}
				/>
			{/if}
			{#if set.museum}
				<FilterMenu
					label="Музей"
					icon={studioIcon}
					active={!!filters.museum && !openMenu}
					open={openMenu === 'museum'}
					ontoggle={(v) => (openMenu = v ? 'museum' : null)}
					load={museums}
					searchPlaceholder="Поиск музея или собрания…"
					onselect={(s) => apply({ museum: s.value }, true)}
				/>
			{/if}
			{#if set.publisherLabel}
				<FilterMenu
					label={set.publisherLabel}
					icon={studioIcon}
					active={!!filters.publisher && !openMenu}
					open={openMenu === 'publisher'}
					ontoggle={(v) => (openMenu = v ? 'publisher' : null)}
					load={publishers}
					searchPlaceholder="Поиск по названию…"
					onselect={(s) => apply({ publisher: s.value }, true)}
				/>
			{/if}
			<FilterMenu
				label="Жанр или тег"
				icon={tagIcon}
				active={!!filters.tag && !openMenu}
				open={openMenu === 'tag'}
				ontoggle={(v) => (openMenu = v ? 'tag' : null)}
				reloadKey={tagKind}
				load={tagOptions}
				searchPlaceholder={tagKind === 'genre' ? 'Поиск жанра…' : 'Поиск тега…'}
				more={tagKind === 'genre'
					? { href: '/genres', label: 'Все жанры' }
					: { href: '/tags', label: 'Все теги' }}
				onselect={(s) => apply({ tag: s.value })}
			>
				{#snippet header()}
					<div class="flex shrink-0 flex-wrap items-center gap-4">
						{#each [{ value: 'genre', title: 'Жанры' }, { value: 'tag', title: 'Теги' }] as t (t.value)}
							<button
								type="button"
								class="filter-tab"
								class:filter-tab-on={tagKind === t.value}
								onclick={() => (tagKind = t.value as SchemaTagWithCount['kind'])}>{t.title}</button
							>
						{/each}
					</div>
				{/snippet}
			</FilterMenu>
			{#if set.country}
				<FilterMenu
					label="Страна"
					icon={countryIcon}
					active={!!filters.country && !openMenu}
					open={openMenu === 'country'}
					ontoggle={(v) => (openMenu = v ? 'country' : null)}
					load={countryList}
					searchPlaceholder="Поиск страны…"
					onselect={(s) => apply({ country: s.value })}
				/>
			{/if}
			<FilterMenu
				label="Год / период"
				icon={yearIcon}
				active={!!yearValue && !openMenu}
				open={openMenu === 'year'}
				ontoggle={(v) => (openMenu = v ? 'year' : null)}
			>
				<YearRange
					year={filters.year}
					yearFrom={filters.yearFrom}
					yearTo={filters.yearTo}
					onapply={setYearRange}
				/>
			</FilterMenu>
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
