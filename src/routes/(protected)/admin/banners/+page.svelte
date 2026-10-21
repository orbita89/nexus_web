<script lang="ts">
	import { browser } from '$app/env';
	import DOMPurify from 'dompurify';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import {
		BANNER_BUTTON_STYLES,
		BANNER_KINDS,
		BANNER_LIMITS,
		BANNER_PAGES,
		BANNER_THEMES,
		adminListBanners,
		bannerFieldError,
		createBanner,
		deleteBanner,
		isBannerPage,
		updateBanner,
		type Banner,
		type BannerButtonStyle,
		type BannerKind,
		type BannerPage,
		type BannerTarget,
		type BannerTheme,
		type CreateBanner
	} from '#lib/catalog/banners.ts';
	import { FEATURED_THEMES } from '#lib/catalog/themes.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Баннеры v2: фильтр (цель, поиск), таблица; форма с видом, темой, приоритетом, HTML с живым
	// превью (DOMPurify, только в браузере), редакторами слайдов, кнопок, целей и исключений.
	// 400 с field (`slides[1].image_url`) показываются у нужного поля, без field — в общем алерте.
	const PAGE = 20;
	const PAGE_TITLES: Record<BannerPage, string> = {
		home: 'Главная',
		films: 'Фильмы (ровно /films)',
		series: 'Сериалы',
		books: 'Книги',
		games: 'Игры',
		people: 'Люди'
	};
	const KIND_TITLES: Record<BannerKind, string> = {
		image: 'Картинка',
		html: 'HTML',
		slides: 'Слайды'
	};
	const STYLE_TITLES: Record<BannerButtonStyle, string> = {
		primary: 'Основная',
		secondary: 'Вторичная',
		ghost: 'Прозрачная'
	};
	const THEME_TITLES = new Map<string, string>(FEATURED_THEMES.map((t) => [t.id, t.label]));
	const themeTitle = (id: string | null | undefined) => (id ? (THEME_TITLES.get(id) ?? id) : '—');

	interface SlideDraft {
		key: number;
		image_url: string;
		title: string;
		subtitle: string;
		content_html: string;
		link_url: string;
	}
	interface ButtonDraft {
		key: number;
		label: string;
		url: string;
		style: BannerButtonStyle;
	}
	type TargetMode = 'all' | 'page' | 'path';
	interface TargetDraft {
		key: number;
		type: TargetMode;
		page: BannerPage;
		pattern: string;
	}
	interface Draft {
		kind: BannerKind;
		theme: BannerTheme | '';
		title: string;
		subtitle: string;
		image_url: string;
		link_url: string;
		content_html: string;
		position: number;
		priority: number;
		is_active: boolean;
		starts_at: string;
		ends_at: string;
		slides: SlideDraft[];
		buttons: ButtonDraft[];
		targets: TargetDraft[];
		exclude_paths: { key: number; pattern: string }[];
	}

	let seq = 0;
	const nextKey = () => ++seq;
	const emptySlide = (): SlideDraft => ({
		key: nextKey(),
		image_url: '',
		title: '',
		subtitle: '',
		content_html: '',
		link_url: ''
	});
	const emptyButton = (): ButtonDraft => ({ key: nextKey(), label: '', url: '', style: 'primary' });
	const emptyTarget = (type: TargetMode = 'all'): TargetDraft => ({
		key: nextKey(),
		type,
		page: 'home',
		pattern: ''
	});
	const emptyDraft = (): Draft => ({
		kind: 'image',
		theme: '',
		title: '',
		subtitle: '',
		image_url: '',
		link_url: '',
		content_html: '',
		position: 0,
		priority: 0,
		is_active: true,
		starts_at: '',
		ends_at: '',
		slides: [],
		buttons: [],
		targets: [emptyTarget('all')],
		exclude_paths: []
	});

	let banners = $state<Banner[]>([]);
	let total = $state(0);
	let offset = $state(0);
	/** '' — все, 'all', 'page', 'path'. */
	let targetFilter = $state<'' | TargetMode>('');
	let q = $state('');
	let error = $state('');
	let formError = $state('');
	/** Ошибки полей: ключ — путь через точку (`slides.1.image_url`). */
	let fieldErrors = $state<Record<string, string>>({});
	let saving = $state(false);
	/** null — форма закрыта, 'new' — создание, иначе id редактируемого. */
	let editing = $state<string | null>(null);
	let draft = $state<Draft>(emptyDraft());
	let confirmDelete = $state<string | null>(null);

	const pad = (n: number) => String(n).padStart(2, '0');
	function toLocalInput(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
	const formatDate = (iso: string | null | undefined) =>
		iso ? new Date(iso).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' }) : '—';

	/** Превью HTML: санитизация только в браузере (DOMPurify нужен DOM), на SSR — пусто. */
	function clean(html: string): string {
		if (!browser || !html.trim()) return '';
		return DOMPurify.sanitize(html, {
			FORBID_TAGS: ['style', 'script', 'iframe', 'form'],
			FORBID_ATTR: ['style']
		});
	}

	async function load() {
		error = '';
		try {
			const page = await adminListBanners(api, {
				target: targetFilter || undefined,
				q: q.trim() || undefined,
				limit: PAGE,
				offset
			});
			banners = page.items;
			total = page.total;
			if (!banners.length && offset > 0 && total > 0) {
				offset = Math.max(0, offset - PAGE);
				await load();
			}
		} catch (e) {
			error = errorMessage(e);
		}
	}
	void load();

	function applyFilters(event?: SubmitEvent) {
		event?.preventDefault();
		offset = 0;
		void load();
	}

	function go(to: number) {
		offset = to;
		void load();
	}

	function resetErrors() {
		formError = '';
		fieldErrors = {};
	}

	function openNew() {
		draft = emptyDraft();
		resetErrors();
		editing = 'new';
	}

	function targetToDraft(t: BannerTarget): TargetDraft {
		if (t.type === 'page')
			return { ...emptyTarget('page'), page: isBannerPage(t.page) ? t.page : 'home' };
		if (t.type === 'path') return { ...emptyTarget('path'), pattern: t.pattern };
		return emptyTarget('all');
	}

	function openEdit(b: Banner) {
		draft = {
			kind: b.kind,
			theme: (BANNER_THEMES as readonly string[]).includes(b.theme ?? '')
				? (b.theme as BannerTheme)
				: '',
			title: b.title,
			subtitle: b.subtitle ?? '',
			image_url: b.image_url ?? '',
			link_url: b.link_url ?? '',
			content_html: b.content_html ?? '',
			position: b.position,
			priority: b.priority,
			is_active: b.is_active,
			starts_at: toLocalInput(b.starts_at),
			ends_at: toLocalInput(b.ends_at),
			slides: b.slides.map((s) => ({
				key: nextKey(),
				image_url: s.image_url ?? '',
				title: s.title ?? '',
				subtitle: s.subtitle ?? '',
				content_html: s.content_html ?? '',
				link_url: s.link_url ?? ''
			})),
			buttons: b.buttons.map((x) => ({ key: nextKey(), ...x })),
			targets: b.targets.length ? b.targets.map(targetToDraft) : [emptyTarget('all')],
			exclude_paths: b.exclude_paths.map((pattern) => ({ key: nextKey(), pattern }))
		};
		resetErrors();
		editing = b.id;
	}

	function move<T>(list: T[], i: number, delta: number) {
		const j = i + delta;
		if (j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
	}

	const isHttp = (v: string) => /^https?:\/\//i.test(v);
	const isLink = (v: string) => isHttp(v) || (v.startsWith('/') && !v.startsWith('//'));
	const isPattern = (v: string) => v.startsWith('/') && !/[?#]/.test(v) && v.length <= 200;
	const orNull = (v: string) => v.trim() || null;

	/** Клиентская проверка: те же ключи, что у ошибок бэкенда. */
	function validate(): Record<string, string> {
		const e: Record<string, string> = {};
		const d = draft;
		if (!d.title.trim()) e.title = 'Введите заголовок.';
		else if (d.title.trim().length > 300) e.title = 'Не длиннее 300 символов.';
		const img = d.image_url.trim();
		if (d.kind === 'image' && !img) e.image_url = 'Для вида «Картинка» URL обязателен.';
		else if (img && !isHttp(img)) e.image_url = 'Только http(s).';
		const link = d.link_url.trim();
		if (link && !isLink(link)) e.link_url = 'http(s)://… или путь сайта, начинающийся с /.';
		if (d.kind === 'html' && !d.content_html.trim())
			e.content_html = 'Для вида «HTML» нужен текст.';
		if (d.kind === 'slides' && !d.slides.length) e.slides = 'Добавьте хотя бы один слайд.';
		d.slides.forEach((s, i) => {
			if (s.image_url.trim() && !isHttp(s.image_url.trim()))
				e[`slides.${i}.image_url`] = 'Только http(s).';
			if (s.title.trim().length > 300) e[`slides.${i}.title`] = 'Не длиннее 300 символов.';
			if (s.link_url.trim() && !isLink(s.link_url.trim()))
				e[`slides.${i}.link_url`] = 'http(s)://… или путь /….';
		});
		d.buttons.forEach((b, i) => {
			const l = b.label.trim();
			if (!l || l.length > BANNER_LIMITS.buttonLabel)
				e[`buttons.${i}.label`] = `От 1 до ${BANNER_LIMITS.buttonLabel} символов.`;
			if (!isLink(b.url.trim())) e[`buttons.${i}.url`] = 'http(s)://… или путь /….';
		});
		if (!d.targets.length) e.targets = 'Нужна хотя бы одна цель.';
		d.targets.forEach((t, i) => {
			if (t.type === 'path' && !isPattern(t.pattern.trim()))
				e[`targets.${i}.pattern`] = 'Начинается с /, без ? и #, до 200 символов.';
		});
		d.exclude_paths.forEach((x, i) => {
			if (!isPattern(x.pattern.trim()))
				e[`exclude_paths.${i}`] = 'Начинается с /, без ? и #, до 200 символов.';
		});
		if (d.starts_at && d.ends_at && new Date(d.ends_at) <= new Date(d.starts_at))
			e.ends_at = 'Конец показа должен быть позже начала.';
		return e;
	}

	function buildBody(): CreateBanner {
		const d = draft;
		return {
			kind: d.kind,
			theme: d.theme || null,
			title: d.title.trim(),
			subtitle: orNull(d.subtitle),
			image_url: orNull(d.image_url),
			link_url: orNull(d.link_url),
			content_html: orNull(d.content_html),
			position: Number(d.position) || 0,
			priority: Number(d.priority) || 0,
			is_active: d.is_active,
			starts_at: toIso(d.starts_at),
			ends_at: toIso(d.ends_at),
			slides: d.slides.map((s) => ({
				image_url: orNull(s.image_url),
				title: orNull(s.title),
				subtitle: orNull(s.subtitle),
				content_html: orNull(s.content_html),
				link_url: orNull(s.link_url)
			})),
			buttons: d.buttons.map((b) => ({ label: b.label.trim(), url: b.url.trim(), style: b.style })),
			targets: d.targets.map((t): BannerTarget => {
				if (t.type === 'page') return { type: 'page', page: t.page };
				if (t.type === 'path') return { type: 'path', pattern: t.pattern.trim() };
				return { type: 'all' };
			}),
			exclude_paths: d.exclude_paths.map((x) => x.pattern.trim())
		};
	}

	/** Ключи, у которых в форме есть место для ошибки. */
	const FIELD_KEY =
		/^(title|subtitle|image_url|link_url|content_html|position|priority|theme|kind|starts_at|ends_at|slides|buttons|targets|exclude_paths(\.\d+)?|slides\.\d+(\.(image_url|title|subtitle|content_html|link_url))?|buttons\.\d+(\.(label|url|style))?|targets\.\d+(\.(page|pattern|type))?)$/;

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!editing) return;
		resetErrors();
		const local = validate();
		if (Object.keys(local).length) {
			fieldErrors = local;
			formError = 'Исправьте отмеченные поля.';
			return;
		}
		saving = true;
		try {
			const body = buildBody();
			if (editing === 'new') await createBanner(api, body);
			else await updateBanner(api, editing, body);
			editing = null;
			await load();
		} catch (e) {
			const fe = bannerFieldError(e);
			const key = fe?.path.join('.') ?? '';
			if (fe && key && FIELD_KEY.test(key)) {
				fieldErrors = { [key]: fe.message };
				formError = 'Исправьте отмеченное поле.';
			} else {
				formError = fe ? (fe.field ? `${fe.field}: ${fe.message}` : fe.message) : errorMessage(e);
			}
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		error = '';
		try {
			await deleteBanner(api, id);
			confirmDelete = null;
			if (editing === id) editing = null;
			await load();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	function status(b: Banner): string {
		if (!b.is_active) return 'Выключен';
		const now = Date.now();
		if (b.starts_at && new Date(b.starts_at).getTime() > now) return 'Запланирован';
		if (b.ends_at && new Date(b.ends_at).getTime() <= now) return 'Завершён';
		return 'Показывается';
	}

	function targetLabel(t: BannerTarget): string {
		if (t.type === 'all') return 'Все страницы';
		if (t.type === 'page') return isBannerPage(t.page) ? PAGE_TITLES[t.page] : t.page;
		return t.pattern;
	}

	function thumb(b: Banner): string | null {
		return b.image_url || b.slides.find((s) => s.image_url)?.image_url || null;
	}

	const inputCls = (key: string, base = 'input w-full input-sm') => [
		base,
		{ 'input-error': !!fieldErrors[key] }
	];
	const previewHtml = $derived(clean(draft.content_html));
</script>

{#snippet fieldError(key: string)}
	{#if fieldErrors[key]}<p class="mt-1 text-xs text-error">{fieldErrors[key]}</p>{/if}
{/snippet}

<svelte:head><title>Баннеры — Админка — Nexus</title></svelte:head>

<h1 class="mb-6 text-3xl font-black">Баннеры</h1>

<form class="mb-4 flex flex-wrap items-end gap-2" onsubmit={applyFilters} role="search">
	<label class="sr-only" for="banner-filter">Цель</label>
	<select
		id="banner-filter"
		class="select w-44 select-sm"
		bind:value={targetFilter}
		onchange={() => applyFilters()}
	>
		<option value="">Все цели</option>
		<option value="all">На всех страницах</option>
		<option value="page">По странице</option>
		<option value="path">По пути</option>
	</select>
	<label class="sr-only" for="banner-q">Поиск по заголовку</label>
	<input
		id="banner-q"
		class="input w-56 input-sm"
		type="search"
		placeholder="Поиск по заголовку"
		bind:value={q}
	/>
	<button class="btn btn-sm">Найти</button>
	<button type="button" class="btn btn-primary btn-sm" onclick={openNew}>Новый баннер</button>
</form>

{#if editing}
	<form
		class="mb-6 grid gap-3 rounded-box bg-base-200 p-4 ring-1 ring-base-300 md:grid-cols-2"
		onsubmit={save}
		novalidate
		aria-label={editing === 'new' ? 'Новый баннер' : 'Изменить баннер'}
	>
		<h2 class="text-lg font-bold md:col-span-2">
			{editing === 'new' ? 'Новый баннер' : 'Изменить баннер'}
		</h2>

		<div class="grid gap-3 sm:grid-cols-4 md:col-span-2">
			<label class="floating-label">
				<span>Вид</span>
				<select class={inputCls('kind', 'select w-full select-sm')} bind:value={draft.kind}>
					{#each BANNER_KINDS as k (k)}<option value={k}>{KIND_TITLES[k]}</option>{/each}
				</select>
				{@render fieldError('kind')}
			</label>
			<label class="floating-label">
				<span>Тема</span>
				<select class={inputCls('theme', 'select w-full select-sm')} bind:value={draft.theme}>
					<option value="">Без темы</option>
					{#each BANNER_THEMES as t (t)}<option value={t}>{themeTitle(t)}</option>{/each}
				</select>
				{@render fieldError('theme')}
			</label>
			<label class="floating-label">
				<span>Приоритет</span>
				<input
					class={inputCls('priority')}
					type="number"
					placeholder="Приоритет"
					bind:value={draft.priority}
				/>
				{@render fieldError('priority')}
			</label>
			<label class="floating-label">
				<span>Позиция</span>
				<input
					class={inputCls('position')}
					type="number"
					placeholder="Позиция"
					bind:value={draft.position}
				/>
				{@render fieldError('position')}
			</label>
		</div>

		<label class="floating-label md:col-span-2">
			<span>Заголовок</span>
			<input
				class={inputCls('title')}
				maxlength="300"
				placeholder="Заголовок"
				bind:value={draft.title}
			/>
			{@render fieldError('title')}
		</label>
		<label class="floating-label md:col-span-2">
			<span>Подзаголовок</span>
			<input class={inputCls('subtitle')} placeholder="Подзаголовок" bind:value={draft.subtitle} />
			{@render fieldError('subtitle')}
		</label>
		<label class="floating-label">
			<span>URL картинки{draft.kind === 'image' ? '' : ' (фон, необязательно)'}</span>
			<input
				class={inputCls('image_url')}
				type="url"
				placeholder="URL картинки (https://…)"
				bind:value={draft.image_url}
			/>
			{@render fieldError('image_url')}
		</label>
		<label class="floating-label">
			<span>Ссылка</span>
			<input
				class={inputCls('link_url')}
				placeholder="Ссылка: https://… или /films/dune-2021"
				bind:value={draft.link_url}
			/>
			{@render fieldError('link_url')}
		</label>
		{#if isHttp(draft.image_url.trim())}
			<img
				src={draft.image_url.trim()}
				alt="Превью картинки"
				class="aspect-[16/5] w-full max-w-2xl rounded-box object-cover ring-1 ring-base-300 md:col-span-2"
			/>
		{/if}

		<div class="grid gap-3 md:col-span-2 md:grid-cols-2">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">
					HTML-контент {draft.kind === 'html' ? '' : '(необязательно, текст поверх картинки)'}
				</span>
				<textarea
					class={inputCls('content_html', 'textarea h-48 w-full font-mono textarea-sm')}
					placeholder="<h2>Заголовок</h2><p>Текст…</p>"
					bind:value={draft.content_html}></textarea>
				{@render fieldError('content_html')}
			</label>
			<div>
				<span class="mb-1 block text-sm font-medium">Превью (после очистки)</span>
				<div
					class="prose-sm prose h-48 max-w-none overflow-auto rounded-box bg-base-100 p-3 ring-1 ring-base-300"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- очищено DOMPurify -->
					{@html previewHtml}
				</div>
			</div>
		</div>

		<!-- Слайды -->
		<fieldset class="rounded-box p-3 ring-1 ring-base-300 md:col-span-2">
			<legend class="px-1 text-sm font-bold">
				Слайды ({draft.slides.length}/{BANNER_LIMITS.slides})
			</legend>
			{@render fieldError('slides')}
			{#each draft.slides as s, i (s.key)}
				<div class="mb-3 grid gap-2 rounded-box bg-base-100 p-3 md:grid-cols-2">
					<div class="flex items-center gap-1 md:col-span-2">
						<span class="text-sm font-medium">Слайд {i + 1}</span>
						<span class="flex-1"></span>
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							aria-label="Слайд {i + 1} выше"
							disabled={i === 0}
							onclick={() => move(draft.slides, i, -1)}>↑</button
						>
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							aria-label="Слайд {i + 1} ниже"
							disabled={i === draft.slides.length - 1}
							onclick={() => move(draft.slides, i, 1)}>↓</button
						>
						<button
							type="button"
							class="btn btn-ghost text-error btn-xs"
							onclick={() => draft.slides.splice(i, 1)}>Удалить</button
						>
					</div>
					<label class="floating-label">
						<span>Картинка</span>
						<input
							class={inputCls(`slides.${i}.image_url`)}
							type="url"
							placeholder="Картинка (https://…)"
							bind:value={s.image_url}
						/>
						{@render fieldError(`slides.${i}.image_url`)}
					</label>
					<label class="floating-label">
						<span>Ссылка</span>
						<input
							class={inputCls(`slides.${i}.link_url`)}
							placeholder="Ссылка: https://… или /…"
							bind:value={s.link_url}
						/>
						{@render fieldError(`slides.${i}.link_url`)}
					</label>
					<label class="floating-label">
						<span>Заголовок</span>
						<input
							class={inputCls(`slides.${i}.title`)}
							maxlength="300"
							placeholder="Заголовок"
							bind:value={s.title}
						/>
						{@render fieldError(`slides.${i}.title`)}
					</label>
					<label class="floating-label">
						<span>Подзаголовок</span>
						<input
							class={inputCls(`slides.${i}.subtitle`)}
							placeholder="Подзаголовок"
							bind:value={s.subtitle}
						/>
						{@render fieldError(`slides.${i}.subtitle`)}
					</label>
					<label class="block md:col-span-2">
						<span class="mb-1 block text-xs">HTML слайда</span>
						<textarea
							class={inputCls(
								`slides.${i}.content_html`,
								'textarea h-20 w-full font-mono textarea-sm'
							)}
							bind:value={s.content_html}></textarea>
						{@render fieldError(`slides.${i}.content_html`)}
					</label>
					{#if s.content_html.trim()}
						<div
							class="prose-sm prose max-w-none rounded-box p-2 ring-1 ring-base-300 md:col-span-2"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- очищено DOMPurify -->
							{@html clean(s.content_html)}
						</div>
					{/if}
				</div>
			{/each}
			<button
				type="button"
				class="btn btn-sm"
				disabled={draft.slides.length >= BANNER_LIMITS.slides}
				onclick={() => draft.slides.push(emptySlide())}>Добавить слайд</button
			>
		</fieldset>

		<!-- Кнопки -->
		<fieldset class="rounded-box p-3 ring-1 ring-base-300 md:col-span-2">
			<legend class="px-1 text-sm font-bold">
				Кнопки ({draft.buttons.length}/{BANNER_LIMITS.buttons})
			</legend>
			{@render fieldError('buttons')}
			{#each draft.buttons as b, i (b.key)}
				<div class="mb-2 grid items-start gap-2 sm:grid-cols-[1fr_2fr_10rem_auto]">
					<label class="floating-label">
						<span>Текст</span>
						<input
							class={inputCls(`buttons.${i}.label`)}
							maxlength={BANNER_LIMITS.buttonLabel}
							placeholder="Текст кнопки"
							bind:value={b.label}
						/>
						{@render fieldError(`buttons.${i}.label`)}
					</label>
					<label class="floating-label">
						<span>URL</span>
						<input
							class={inputCls(`buttons.${i}.url`)}
							placeholder="https://… или /collections/…"
							bind:value={b.url}
						/>
						{@render fieldError(`buttons.${i}.url`)}
					</label>
					<label class="floating-label">
						<span>Стиль</span>
						<select
							class={inputCls(`buttons.${i}.style`, 'select w-full select-sm')}
							bind:value={b.style}
						>
							{#each BANNER_BUTTON_STYLES as st (st)}<option value={st}>{STYLE_TITLES[st]}</option
								>{/each}
						</select>
						{@render fieldError(`buttons.${i}.style`)}
					</label>
					<div class="flex gap-1">
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							aria-label="Кнопка {i + 1} выше"
							disabled={i === 0}
							onclick={() => move(draft.buttons, i, -1)}>↑</button
						>
						<button
							type="button"
							class="btn btn-ghost text-error btn-sm"
							aria-label="Удалить кнопку {i + 1}"
							onclick={() => draft.buttons.splice(i, 1)}>✕</button
						>
					</div>
				</div>
			{/each}
			<button
				type="button"
				class="btn btn-sm"
				disabled={draft.buttons.length >= BANNER_LIMITS.buttons}
				onclick={() => draft.buttons.push(emptyButton())}>Добавить кнопку</button
			>
		</fieldset>

		<!-- Цели -->
		<fieldset class="rounded-box p-3 ring-1 ring-base-300">
			<legend class="px-1 text-sm font-bold">
				Где показывать ({draft.targets.length}/{BANNER_LIMITS.targets})
			</legend>
			{@render fieldError('targets')}
			{#each draft.targets as t, i (t.key)}
				<div class="mb-2 flex flex-wrap items-start gap-2">
					<select
						class={inputCls(`targets.${i}.type`, 'select w-36 select-sm')}
						aria-label="Тип цели {i + 1}"
						bind:value={t.type}
					>
						<option value="all">Все страницы</option>
						<option value="page">Страница</option>
						<option value="path">Путь</option>
					</select>
					{#if t.type === 'page'}
						<select
							class={inputCls(`targets.${i}.page`, 'select w-48 select-sm')}
							aria-label="Страница цели {i + 1}"
							bind:value={t.page}
						>
							{#each BANNER_PAGES as p (p)}<option value={p}>{PAGE_TITLES[p]}</option>{/each}
						</select>
					{:else if t.type === 'path'}
						<div class="min-w-40 flex-1">
							<input
								class={inputCls(`targets.${i}.pattern`)}
								aria-label="Шаблон пути цели {i + 1}"
								placeholder="/films/*"
								maxlength="200"
								bind:value={t.pattern}
							/>
						</div>
					{/if}
					<button
						type="button"
						class="btn btn-ghost text-error btn-sm"
						aria-label="Удалить цель {i + 1}"
						onclick={() => draft.targets.splice(i, 1)}>✕</button
					>
					<div class="w-full">
						{@render fieldError(`targets.${i}`)}
						{@render fieldError(`targets.${i}.type`)}
						{@render fieldError(`targets.${i}.page`)}
						{@render fieldError(`targets.${i}.pattern`)}
					</div>
				</div>
			{/each}
			<button
				type="button"
				class="btn btn-sm"
				disabled={draft.targets.length >= BANNER_LIMITS.targets}
				onclick={() => draft.targets.push(emptyTarget('page'))}>Добавить цель</button
			>
			<p class="mt-2 text-xs text-base-content/60">
				«Фильмы» — только /films; для страниц фильмов — путь /films/*.
			</p>
		</fieldset>

		<!-- Исключения -->
		<fieldset class="rounded-box p-3 ring-1 ring-base-300">
			<legend class="px-1 text-sm font-bold">Не показывать на</legend>
			{@render fieldError('exclude_paths')}
			{#each draft.exclude_paths as x, i (x.key)}
				<div class="mb-2 flex items-start gap-2">
					<div class="flex-1">
						<input
							class={inputCls(`exclude_paths.${i}`)}
							aria-label="Исключённый путь {i + 1}"
							placeholder="/collections/*"
							maxlength="200"
							bind:value={x.pattern}
						/>
						{@render fieldError(`exclude_paths.${i}`)}
					</div>
					<button
						type="button"
						class="btn btn-ghost text-error btn-sm"
						aria-label="Удалить исключение {i + 1}"
						onclick={() => draft.exclude_paths.splice(i, 1)}>✕</button
					>
				</div>
			{/each}
			<button
				type="button"
				class="btn btn-sm"
				onclick={() => draft.exclude_paths.push({ key: nextKey(), pattern: '' })}
				>Добавить путь</button
			>
			<p class="mt-2 text-xs text-base-content/60">/admin/* исключён всегда.</p>
		</fieldset>

		<label class="floating-label">
			<span>Начало показа</span>
			<input class={inputCls('starts_at')} type="datetime-local" bind:value={draft.starts_at} />
			{@render fieldError('starts_at')}
		</label>
		<label class="floating-label">
			<span>Конец показа</span>
			<input class={inputCls('ends_at')} type="datetime-local" bind:value={draft.ends_at} />
			{@render fieldError('ends_at')}
		</label>
		<label class="flex items-center gap-2 text-sm md:col-span-2">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={draft.is_active} />
			Активен
		</label>
		{#if formError}<div class="md:col-span-2"><Alert>{formError}</Alert></div>{/if}
		<div class="flex gap-2 md:col-span-2">
			<button class="btn btn-primary btn-sm" disabled={saving}>
				{editing === 'new' ? 'Создать' : 'Сохранить'}
			</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (editing = null)}
				>Отмена</button
			>
		</div>
	</form>
{/if}

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
	<table class="table">
		<thead>
			<tr>
				<th></th><th>Заголовок</th><th>Вид</th><th>Где</th><th>Приоритет</th><th>Тема</th><th
					>Статус</th
				><th>Период</th><th></th>
			</tr>
		</thead>
		<tbody>
			{#each banners as b (b.id)}
				{@const img = thumb(b)}
				<tr>
					<td>
						{#if img}
							<img src={img} alt="" loading="lazy" class="h-10 w-24 rounded object-cover" />
						{:else}
							<div class="h-10 w-24 rounded bg-base-300"></div>
						{/if}
					</td>
					<td>
						<div class="font-medium">{b.title}</div>
						{#if b.subtitle}<div class="text-sm text-base-content/60">{b.subtitle}</div>{/if}
					</td>
					<td class="text-sm whitespace-nowrap">
						{KIND_TITLES[b.kind] ?? b.kind}{#if b.kind === 'slides'}&nbsp;({b.slides.length}){/if}
						{#if b.buttons.length}<div class="text-xs text-base-content/60">
								кнопок: {b.buttons.length}
							</div>{/if}
					</td>
					<td class="text-sm">
						<div class="flex max-w-56 flex-wrap gap-1">
							{#each b.targets as t, i (i)}
								<span class={['badge badge-sm', t.type === 'path' && 'font-mono']}
									>{targetLabel(t)}</span
								>
							{/each}
							{#each b.exclude_paths as x (x)}
								<span class="badge badge-ghost font-mono badge-sm">не {x}</span>
							{/each}
						</div>
					</td>
					<td class="tabular-nums">{b.priority}</td>
					<td class="text-sm">{themeTitle(b.theme)}</td>
					<td class="text-sm">{status(b)}</td>
					<td class="text-sm whitespace-nowrap"
						>{formatDate(b.starts_at)} — {formatDate(b.ends_at)}</td
					>
					<td class="text-right whitespace-nowrap">
						{#if confirmDelete === b.id}
							<span class="text-sm">Удалить?</span>
							<button class="btn btn-error btn-xs" onclick={() => remove(b.id)}>Удалить</button>
							<button class="btn btn-ghost btn-xs" onclick={() => (confirmDelete = null)}
								>Отмена</button
							>
						{:else}
							<button
								class="btn btn-ghost btn-xs"
								aria-label="Изменить баннер {b.title}"
								onclick={() => openEdit(b)}>Изменить</button
							>
							<button
								class="btn btn-ghost text-error btn-xs"
								aria-label="Удалить баннер {b.title}"
								onclick={() => (confirmDelete = b.id)}>Удалить</button
							>
						{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="9" class="text-center text-base-content/60">Баннеров нет</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#if total > PAGE}
	<div class="mt-4 flex items-center gap-2">
		<button
			class="btn btn-sm"
			disabled={offset === 0}
			onclick={() => go(Math.max(0, offset - PAGE))}>Назад</button
		>
		<span class="text-sm tabular-nums">
			{offset + 1}–{Math.min(offset + PAGE, total)} из {total}
		</span>
		<button class="btn btn-sm" disabled={offset + PAGE >= total} onclick={() => go(offset + PAGE)}
			>Вперёд</button
		>
	</div>
{/if}
