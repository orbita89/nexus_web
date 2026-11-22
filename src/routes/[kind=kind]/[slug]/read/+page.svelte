<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, authedFetch, ensureSession, session } from '#lib/auth/session.svelte.ts';
	import * as marks from '#lib/reader/annotations.ts';
	import { HIGHLIGHT_COLORS, colorHex, type Annotation } from '#lib/reader/annotations.ts';
	import { idbCache } from '#lib/reader/cache.ts';
	import { OpenError, openBook, savePlace, savedPlace } from '#lib/reader/open.ts';
	import {
		FONT_MAX,
		FONT_MIN,
		LAYOUTS,
		THEMES,
		layoutAttributes,
		loadSettings,
		saveSettings,
		type Layout,
		type ReaderSettings,
		type Theme
	} from '#lib/reader/settings.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import TutorDrawer from '#lib/components/tutor/TutorDrawer.svelte';
	import type { PageProps } from './$types';

	// Читалка EPUB (foliate-js, грузится только здесь). Полный экран: своя шапка (выход к книге,
	// оглавление, настройки), книга, полоса места внизу. Отображение — страницей, разворотом или
	// лентой (прокрутка; по умолчанию на телефоне). Оглавление — выезжающая панель с затемнением:
	// щелчок мимо или Esc закрывают. Цвета интерфейса берутся из темы книги, а не из темы сайта —
	// иначе на светлой теме кнопки сайта (светлые) терялись на белом.
	let { data }: PageProps = $props();

	let host = $state<HTMLDivElement>();
	let footnoteDialog = $state<HTMLDialogElement>();
	let footnoteHost = $state<HTMLDivElement>();

	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let error = $state('');
	let errorKind = $state<string>('');
	let loaded = $state(0);
	let total = $state<number | null>(null);
	let fraction = $state(0);
	let chapter = $state('');
	let currentHref = $state('');
	let toc = $state<TocItem[]>([]);
	let tocOpen = $state(false);
	/** Вкладка выезжающей панели: оглавление или свои пометки. */
	let panelTab = $state<'toc' | 'marks'>('toc');

	// Закладки и выделения — свои, по API (только у вошедшего).
	let annotations = $state<Annotation[]>([]);
	/** CFI начала текущей страницы — для закладки «здесь». */
	let currentCfi = $state('');
	/** Выделенный в книге текст, ещё не сохранённый: панель цветов внизу. */
	let selection = $state<{ cfi: string; text: string; doc: Document } | null>(null);
	/** Открытое в редакторе выделение (цвет, заметка). */
	let editing = $state<Annotation | null>(null);
	let editNote = $state('');
	let editColor = $state(0);
	let marksError = $state('');

	// ИИ-преподаватель: панель чата; вопрос по выделенному фрагменту — с цитатой и главой.
	let tutorOpen = $state(false);
	let tutorQuote = $state<string | null>(null);

	/** Открыть чат с ИИ; из панели выделения — с выделенным фрагментом. */
	function askAi(fromSelection = false) {
		if (needLogin()) return;
		if (fromSelection && selection) {
			tutorQuote = selection.text.slice(0, 1500);
			selection.doc.getSelection()?.removeAllRanges();
			selection = null;
		} else tutorQuote = null;
		tutorOpen = true;
	}
	let settingsOpen = $state(false);

	let settings = $state<ReaderSettings>({ theme: 'light', fontSize: 100, layout: 'page' });

	interface TocItem {
		label: string;
		href: string;
		subitems?: TocItem[];
	}

	/** <foliate-view> — без типов: библиотека на чистом JS. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let view: any = null;

	const t = $derived(THEMES[settings.theme]);
	const authed = $derived(session.status === 'authed');
	const bookmarkHere = $derived(
		annotations.find((a) => a.kind === 'bookmark' && a.cfi === currentCfi)
	);
	const ordered = $derived(marks.inBookOrder(annotations));
	const scroll = $derived(settings.layout === 'scroll');
	const percent = $derived(Math.round(fraction * 100));
	const progress = $derived(total ? Math.min(100, Math.round((loaded / total) * 100)) : null);
	/** Цвета интерфейса читалки — CSS-переменные, от темы книги. */
	const vars = $derived(
		`--r-bg:${t.bg};--r-fg:${t.fg};--r-muted:${t.muted};--r-line:${t.line};--r-accent:${t.link}`
	);

	/** CSS внутри страниц книги: тема, размер шрифта; сноски-«aside» в тексте скрыты (они во всплывашке). */
	function bookCss() {
		return `
			@namespace epub "http://www.idpf.org/2007/ops";
			html { color-scheme: ${settings.theme === 'dark' ? 'dark' : 'light'}; }
			html, body { background: ${t.bg} !important; color: ${t.fg} !important; }
			body { font-size: ${settings.fontSize}% !important; line-height: 1.6; }
			a:any-link { color: ${t.link} !important; }
			p, li, blockquote, dd { hyphens: auto; -webkit-hyphens: auto; }
			img, svg { max-width: 100%; height: auto; }
			aside[epub|type~="footnote"], aside[epub|type~="endnote"],
			aside[epub|type~="note"], aside[epub|type~="rearnote"] { display: none; }
		`;
	}

	function applyLayout() {
		if (!view?.renderer) return;
		for (const [name, value] of Object.entries(layoutAttributes(settings.layout)))
			view.renderer.setAttribute(name, value);
		view.renderer.setAttribute('gap', '6%');
	}

	function apply() {
		view?.renderer?.setStyles?.(bookCss());
		saveSettings(settings);
	}

	function setTheme(theme: Theme) {
		settings.theme = theme;
		apply();
	}

	function setLayout(layout: Layout) {
		settings.layout = layout;
		applyLayout();
		saveSettings(settings);
	}

	function changeFont(step: number) {
		settings.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, settings.fontSize + step));
		apply();
	}

	function goTo(href: string) {
		tocOpen = false;
		view?.goTo(href).catch(() => {});
	}

	const loginHref = () => loginUrl({ pathname: `/books/${data.slug}/read`, search: '' });

	/** Действие с пометкой у гостя — на вход (после входа вернёмся в читалку). */
	function needLogin(): boolean {
		if (authed) return false;
		void goto(loginHref());
		return true;
	}

	function fail(e: unknown) {
		marksError = 'Не удалось сохранить: ' + (e instanceof Error ? e.message : 'ошибка сети');
		setTimeout(() => (marksError = ''), 4000);
	}

	async function toggleBookmark() {
		if (needLogin() || !currentCfi) return;
		try {
			if (bookmarkHere) {
				const id = bookmarkHere.id;
				await marks.remove(api, id);
				annotations = annotations.filter((a) => a.id !== id);
			} else {
				const a = await marks.create(api, data.slug, {
					kind: 'bookmark',
					cfi: currentCfi,
					chapter: chapter || null,
					fraction
				});
				annotations = [...annotations.filter((x) => x.id !== a.id), a];
			}
		} catch (e) {
			fail(e);
		}
	}

	/** Выделить выбранный текст цветом; withNote — сразу открыть заметку. */
	async function highlight(color: number, withNote = false) {
		const s = selection;
		if (!s || needLogin()) return;
		selection = null;
		s.doc.getSelection()?.removeAllRanges();
		try {
			const a = await marks.create(api, data.slug, {
				kind: 'highlight',
				cfi: s.cfi,
				text: s.text,
				color,
				chapter: chapter || null,
				fraction
			});
			annotations = [...annotations, a];
			await view?.addAnnotation({ value: a.cfi });
			if (withNote) openEditor(a);
		} catch (e) {
			fail(e);
		}
	}

	function openEditor(a: Annotation) {
		editing = a;
		editNote = a.note ?? '';
		editColor = a.color ?? 0;
	}

	async function saveEditor() {
		const a = editing;
		if (!a) return;
		editing = null;
		try {
			const next = await marks.update(api, a.id, {
				...(a.kind === 'highlight' && { color: editColor }),
				note: editNote.trim() || null
			});
			annotations = annotations.map((x) => (x.id === next.id ? next : x));
			if (next.kind === 'highlight') await view?.addAnnotation({ value: next.cfi });
		} catch (e) {
			fail(e);
		}
	}

	async function removeMark(a: Annotation) {
		if (editing?.id === a.id) editing = null;
		try {
			await marks.remove(api, a.id);
			annotations = annotations.filter((x) => x.id !== a.id);
			if (a.kind === 'highlight') await view?.deleteAnnotation({ value: a.cfi });
		} catch (e) {
			fail(e);
		}
	}

	function goToMark(a: Annotation) {
		tocOpen = false;
		view?.goTo(a.cfi).catch(() => {});
	}

	/** Выделение внутри страницы книги (iframe) → панель цветов. */
	function watchSelection(doc: Document, index: number) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const check = () => {
			const sel = doc.getSelection();
			if (!sel || sel.isCollapsed || !sel.rangeCount) {
				if (selection?.doc === doc) selection = null;
				return;
			}
			const text = sel.toString().replace(/\s+/g, ' ').trim();
			if (!text) return;
			const range = sel.getRangeAt(0);
			selection = { cfi: view.getCFI(index, range), text: text.slice(0, 2000), doc };
		};
		doc.addEventListener('selectionchange', () => {
			clearTimeout(timer);
			timer = setTimeout(check, 250);
		});
	}

	function onKey(e: KeyboardEvent) {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === 'Escape') {
			if (!tocOpen && !settingsOpen) return;
			tocOpen = settingsOpen = false;
		} else if (scroll)
			return; // в ленте стрелки и пробел прокручивают сами
		else if (e.key === 'ArrowLeft' || e.key === 'PageUp') view?.goLeft();
		else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') view?.goRight();
		else return;
		e.preventDefault();
	}

	onMount(() => {
		settings = loadSettings(!matchMedia('(min-width: 48rem)').matches);
		total = data.file.size;
		let closed = false;

		(async () => {
			try {
				// Кто читает — от этого зависит токен и проверка доступа к закрытой книге.
				await ensureSession();
				const { blob } = await openBook(
					data.slug,
					{
						publicRead: data.file.publicRead,
						size: data.file.size,
						onProgress: (l, all) => {
							loaded = l;
							total = all;
						}
					},
					{
						cache: idbCache,
						fetch: session.status === 'authed' ? authedFetch : (r) => fetch(r)
					}
				);
				if (closed) return;

				await import('foliate-js/view.js');
				const { FootnoteHandler } = await import('foliate-js/footnotes.js');
				if (closed || !host) return;

				view = document.createElement('foliate-view');
				view.style.cssText = 'display:block;width:100%;height:100%';
				// eslint-disable-next-line svelte/no-dom-manipulating -- пустой контейнер, его содержимым владеет foliate-js
				host.append(view);
				await view.open(new File([blob], `${data.slug}.epub`, { type: 'application/epub+zip' }));
				applyLayout();
				apply();

				toc = (view.book.toc ?? []) as TocItem[];

				// Свои пометки — до показа страницы, чтобы выделения нарисовались сразу.
				if (session.status === 'authed') {
					annotations = await marks.listBook(api, data.slug).catch(() => []);
				}
				const { Overlayer } = await import('foliate-js/overlayer.js');
				// Глава загрузилась — нарисовать её выделения (foliate сам решает, какие в ней).
				view.addEventListener('create-overlay', () => {
					for (const a of annotations)
						if (a.kind === 'highlight') view.addAnnotation({ value: a.cfi });
				});
				view.addEventListener('draw-annotation', (e: CustomEvent) => {
					const { draw, annotation } = e.detail;
					const a = annotations.find((x) => x.cfi === annotation.value);
					draw(Overlayer.highlight, { color: colorHex(a?.color) });
				});
				// Щелчок по выделению — редактор (цвет, заметка, удалить).
				view.addEventListener('show-annotation', (e: CustomEvent) => {
					const a = annotations.find((x) => x.cfi === e.detail.value);
					if (a) openEditor(a);
				});

				view.addEventListener('relocate', (e: CustomEvent) => {
					const { fraction: f, cfi, tocItem } = e.detail;
					fraction = f ?? 0;
					chapter = tocItem?.label ?? '';
					currentHref = tocItem?.href ?? '';
					if (cfi) {
						currentCfi = cfi;
						savePlace(data.slug, cfi);
					}
				});
				// Клавиши внутри страницы книги (iframe) — те же, что снаружи.
				view.addEventListener('load', (e: CustomEvent) => {
					const { doc, index } = e.detail;
					doc?.addEventListener('keydown', onKey);
					if (doc) watchSelection(doc, index);
				});

				// Сноски: ссылка на сноску — во всплывающее окно, а не переход в конец главы.
				const footnotes = new FootnoteHandler();
				footnotes.addEventListener('before-render', (e: Event) => {
					const fv = (e as CustomEvent).detail.view;
					fv.addEventListener('link', (le: Event) => le.preventDefault());
					fv.style.cssText = 'display:block;width:100%;height:100%';
					// eslint-disable-next-line svelte/no-dom-manipulating -- пустой контейнер, его содержимым владеет foliate-js
					footnoteHost?.replaceChildren(fv);
					fv.renderer.setAttribute('flow', 'scrolled');
					fv.renderer.setStyles?.(bookCss());
				});
				footnotes.addEventListener('render', () => footnoteDialog?.showModal());
				view.addEventListener('link', (e: CustomEvent) =>
					footnotes.handle(view.book, e)?.catch(() => {})
				);
				// Внешние ссылки — в новой вкладке.
				view.addEventListener('external-link', (e: CustomEvent) => {
					e.preventDefault();
					window.open(e.detail.a.href, '_blank', 'noopener');
				});

				// ?at=<cfi> — открыть на пометке (ссылки со страницы книги и из профиля).
				const at = page.url.searchParams.get('at');
				await view.init({ lastLocation: at || savedPlace(data.slug), showTextStart: true });
				status = 'ready';
			} catch (e) {
				if (closed) return;
				status = 'error';
				errorKind = e instanceof OpenError ? e.kind : 'failed';
				error = e instanceof OpenError ? e.message : 'Не удалось открыть книгу: файл повреждён.';
			}
		})();

		return () => {
			closed = true;
			view?.close?.();
			view?.remove();
		};
	});
</script>

<svelte:head>
	<title>{data.title} — читать — Кассандра</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:window onkeydown={onKey} />

{#snippet icon(path: string)}
	<svg
		class="size-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"><path d={path} /></svg
	>
{/snippet}

<!-- Полный экран: шапка сайта на этой странице не выводится (+layout.svelte). -->
<div
	class="reader fixed inset-0 flex flex-col"
	style={vars}
	role="application"
	aria-label="Читалка: {data.title}"
>
	<header class="flex items-center gap-1 border-b px-2 py-1.5 sm:gap-2 sm:px-3">
		<a href="/books/{data.slug}" class="r-btn" title="Закрыть читалку и вернуться к книге">
			{@render icon('M15 18l-6-6 6-6')}
			<span class="hidden sm:inline">К книге</span>
		</a>
		<button
			type="button"
			class="r-btn"
			aria-expanded={tocOpen}
			disabled={status !== 'ready'}
			onclick={() => ((tocOpen = !tocOpen), (settingsOpen = false))}
		>
			{@render icon('M4 6h16M4 12h16M4 18h10')}
			<span class="hidden sm:inline">Оглавление</span>
		</button>
		<div class="min-w-0 flex-1 px-1 text-center">
			<p class="truncate text-sm font-semibold">{data.title}</p>
			{#if chapter}<p class="r-muted truncate text-xs">{chapter}</p>{/if}
		</div>
		<button
			type="button"
			class="r-btn"
			disabled={status !== 'ready'}
			title={authed ? 'Спросить ИИ-преподавателя о книге' : 'Войдите, чтобы обсуждать книгу с ИИ'}
			aria-label="ИИ-преподаватель"
			onclick={() => askAi()}
		>
			<svg
				class="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linejoin="round"
				aria-hidden="true"
				><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg
			>
			<span class="hidden md:inline">ИИ</span>
		</button>
		<button
			type="button"
			class={['r-btn', bookmarkHere && 'r-on']}
			disabled={status !== 'ready'}
			aria-pressed={!!bookmarkHere}
			title={authed
				? bookmarkHere
					? 'Убрать закладку'
					: 'Закладка на этой странице'
				: 'Войдите, чтобы ставить закладки'}
			aria-label={bookmarkHere ? 'Убрать закладку' : 'Поставить закладку'}
			onclick={toggleBookmark}
		>
			<svg
				class="size-5"
				viewBox="0 0 24 24"
				fill={bookmarkHere ? 'currentColor' : 'none'}
				stroke="currentColor"
				stroke-width="2"
				stroke-linejoin="round"
				aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg
			>
		</button>
		<button
			type="button"
			class="r-btn font-serif text-base"
			aria-expanded={settingsOpen}
			aria-label="Настройки чтения"
			onclick={() => ((settingsOpen = !settingsOpen), (tocOpen = false))}>Aa</button
		>
		<a href="/books/{data.slug}" class="r-btn" aria-label="Закрыть читалку">
			{@render icon('M18 6L6 18M6 6l12 12')}
		</a>
	</header>

	<div class="relative min-h-0 flex-1">
		<div bind:this={host} class="absolute inset-0"></div>

		{#if status === 'ready' && !scroll}
			<!-- Края страницы листают: удобно и мышью, и пальцем. В ленте их нет — там прокрутка. -->
			<button
				type="button"
				class="absolute inset-y-0 left-0 w-[12%] cursor-w-resize opacity-0"
				aria-label="Предыдущая страница"
				onclick={() => view?.goLeft()}
			></button>
			<button
				type="button"
				class="absolute inset-y-0 right-0 w-[12%] cursor-e-resize opacity-0"
				aria-label="Следующая страница"
				onclick={() => view?.goRight()}
			></button>
		{/if}

		{#if status === 'loading'}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
				<span class="loading loading-md loading-spinner"></span>
				<p class="r-muted text-sm">
					Открываем книгу{progress !== null && loaded ? `… ${progress}%` : '…'}
				</p>
			</div>
		{:else if status === 'error'}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
				<p class="max-w-md">{error}</p>
				<div class="flex gap-2">
					{#if errorKind === 'login'}
						<a
							href={loginUrl({ pathname: `/books/${data.slug}/read`, search: '' })}
							class="r-btn r-primary">Войти</a
						>
					{/if}
					<a href="/books/{data.slug}" class="r-btn r-outline">К странице книги</a>
				</div>
			</div>
		{/if}

		<!-- Оглавление: выезжающая панель поверх текста с затемнением — щелчок мимо закрывает. -->
		{#if tocOpen}
			<button
				type="button"
				class="absolute inset-0 z-10 bg-black/40"
				aria-label="Закрыть оглавление"
				onclick={() => (tocOpen = false)}
			></button>
			<nav
				class="r-panel absolute inset-y-0 left-0 z-20 flex w-80 max-w-[85%] flex-col border-r shadow-2xl"
				aria-label="Оглавление"
			>
				<div class="flex items-center justify-between gap-2 border-b px-2 py-2">
					<div class="r-seg flex-1" role="tablist">
						<button
							type="button"
							role="tab"
							aria-selected={panelTab === 'toc'}
							class={{ on: panelTab === 'toc' }}
							onclick={() => (panelTab = 'toc')}>Оглавление</button
						>
						<button
							type="button"
							role="tab"
							aria-selected={panelTab === 'marks'}
							class={{ on: panelTab === 'marks' }}
							onclick={() => (panelTab = 'marks')}
							>Пометки{annotations.length ? ` · ${annotations.length}` : ''}</button
						>
					</div>
					<button
						type="button"
						class="r-btn"
						aria-label="Закрыть оглавление"
						onclick={() => (tocOpen = false)}>{@render icon('M18 6L6 18M6 6l12 12')}</button
					>
				</div>
				<div class="r-scroll min-h-0 flex-1 overflow-y-auto p-2">
					{#snippet items(list: TocItem[], depth: number)}
						<ul>
							{#each list as item, i (item.href + i)}
								<li>
									<button
										type="button"
										class={['r-toc', item.href === currentHref && 'r-toc-on']}
										style="padding-left:{0.75 + depth}rem"
										onclick={() => goTo(item.href)}>{item.label}</button
									>
									{#if item.subitems?.length}{@render items(item.subitems, depth + 1)}{/if}
								</li>
							{/each}
						</ul>
					{/snippet}
					{#if panelTab === 'toc'}
						{#if toc.length}{@render items(toc, 0)}{:else}<p class="r-muted p-3 text-sm">
								В книге нет оглавления.
							</p>{/if}
					{:else if !authed}
						<div class="flex flex-col items-start gap-3 p-3 text-sm">
							<p>Войдите, чтобы ставить закладки и выделять текст — они сохранятся в профиле.</p>
							<a href={loginHref()} class="r-btn r-primary">Войти</a>
						</div>
					{:else if !ordered.length}
						<p class="r-muted p-3 text-sm">
							Пока пусто. Закладка — значок в шапке; выделение — выделите текст в книге.
						</p>
					{:else}
						<ul class="flex flex-col gap-1">
							{#each ordered as a (a.id)}
								<li
									class="r-mark"
									style="--mark:{a.kind === 'highlight' ? colorHex(a.color) : 'var(--r-accent)'}"
								>
									<button
										type="button"
										class="min-w-0 flex-1 text-left"
										onclick={() => goToMark(a)}
									>
										<span class="r-muted block text-xs">
											{a.kind === 'bookmark' ? 'Закладка' : 'Выделение'}{a.chapter
												? ` · ${a.chapter}`
												: ''}{a.fraction != null ? ` · ${Math.round(a.fraction * 100)}%` : ''}
										</span>
										{#if a.text}<span class="line-clamp-3 block text-sm">«{a.text}»</span>{/if}
										{#if a.note}<span class="r-muted mt-0.5 line-clamp-2 block text-xs italic"
												>{a.note}</span
											>{/if}
									</button>
									<div class="flex shrink-0 flex-col">
										<button
											type="button"
											class="r-btn r-btn-sm"
											aria-label="Изменить"
											onclick={() => openEditor(a)}>✎</button
										>
										<button
											type="button"
											class="r-btn r-btn-sm"
											aria-label="Удалить"
											onclick={() => removeMark(a)}>✕</button
										>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</nav>
		{/if}

		{#if settingsOpen}
			<button
				type="button"
				class="absolute inset-0 z-10"
				aria-label="Закрыть настройки"
				onclick={() => (settingsOpen = false)}
			></button>
			<div
				class="r-panel absolute top-2 right-2 z-20 flex w-72 max-w-[calc(100%-1rem)] flex-col gap-4 rounded-box border p-4 shadow-2xl"
			>
				<div class="flex flex-col gap-2">
					<span class="r-muted text-xs font-semibold tracking-wide uppercase">Вид</span>
					<div class="r-seg" role="radiogroup" aria-label="Вид">
						{#each Object.entries(LAYOUTS) as [key, title] (key)}
							<button
								type="button"
								role="radio"
								aria-checked={settings.layout === key}
								class={{ on: settings.layout === key }}
								onclick={() => setLayout(key as Layout)}>{title}</button
							>
						{/each}
					</div>
					<p class="r-muted text-xs">
						{#if settings.layout === 'scroll'}Текст прокручивается сплошь, без листания.
						{:else if settings.layout === 'spread'}На широком экране — две страницы рядом.
						{:else}Одна колонка текста, листание по страницам.{/if}
					</p>
				</div>
				<div class="flex items-center justify-between gap-2">
					<span class="r-muted text-xs font-semibold tracking-wide uppercase">Шрифт</span>
					<div class="r-seg">
						<button
							type="button"
							disabled={settings.fontSize <= FONT_MIN}
							aria-label="Мельче"
							onclick={() => changeFont(-10)}>A−</button
						>
						<span class="tabular-nums">{settings.fontSize}%</span>
						<button
							type="button"
							disabled={settings.fontSize >= FONT_MAX}
							aria-label="Крупнее"
							onclick={() => changeFont(10)}>A+</button
						>
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<span class="r-muted text-xs font-semibold tracking-wide uppercase">Тема</span>
					<div class="flex gap-2" role="radiogroup" aria-label="Тема">
						{#each Object.entries(THEMES) as [key, theme] (key)}
							<button
								type="button"
								role="radio"
								aria-checked={settings.theme === key}
								class={['r-swatch', settings.theme === key && 'on']}
								style="background:{theme.bg};color:{theme.fg}"
								onclick={() => setTheme(key as Theme)}>{theme.title}</button
							>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if selection}
		<!-- Выделили текст — цвет одним нажатием; «Заметка» — выделить и сразу написать. -->
		<div class="r-panel flex flex-wrap items-center justify-center gap-2 border-t px-3 py-2">
			{#if authed}
				{#each HIGHLIGHT_COLORS as c, i (c.hex)}
					<button
						type="button"
						class="r-dot"
						style="background:{c.hex}"
						aria-label="Выделить: {c.name}"
						title={c.name}
						onclick={() => highlight(i)}
					></button>
				{/each}
				<button type="button" class="r-btn r-outline" onclick={() => highlight(0, true)}
					>Заметка</button
				>
				<button type="button" class="r-btn r-primary" onclick={() => askAi(true)}
					>Спросить ИИ</button
				>
			{:else}
				<span class="text-sm">Войдите, чтобы выделять текст и писать заметки</span>
				<a href={loginHref()} class="r-btn r-primary">Войти</a>
			{/if}
			<button
				type="button"
				class="r-btn"
				aria-label="Отменить выделение"
				onclick={() => {
					selection?.doc.getSelection()?.removeAllRanges();
					selection = null;
				}}>✕</button
			>
		</div>
	{/if}
	{#if marksError}
		<p class="border-t px-3 py-1.5 text-center text-sm" role="alert" style="color:#dc2626">
			{marksError}
		</p>
	{/if}

	<footer class="flex items-center gap-2 border-t px-2 py-1.5 text-xs sm:px-3">
		{#if !scroll}
			<button
				type="button"
				class="r-btn"
				disabled={status !== 'ready'}
				aria-label="Предыдущая страница"
				onclick={() => view?.goLeft()}>{@render icon('M15 18l-6-6 6-6')}</button
			>
		{/if}
		<input
			type="range"
			class="r-range flex-1"
			min="0"
			max="1"
			step="0.001"
			value={fraction}
			disabled={status !== 'ready'}
			aria-label="Место в книге"
			oninput={(e) => view?.goToFraction(Number(e.currentTarget.value))}
		/>
		<span class="r-muted w-10 text-right tabular-nums">{percent}%</span>
		{#if !scroll}
			<button
				type="button"
				class="r-btn"
				disabled={status !== 'ready'}
				aria-label="Следующая страница"
				onclick={() => view?.goRight()}>{@render icon('M9 18l6-6-6-6')}</button
			>
		{/if}
	</footer>
</div>

<TutorDrawer
	bind:open={tutorOpen}
	slug={data.slug}
	title={data.title}
	bind:quote={tutorQuote}
	chapter={chapter || null}
	{fraction}
/>

{#if editing}
	<!-- Редактор пометки: цвет выделения, заметка, удалить. -->
	<div
		class="reader fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
		style={vars}
		role="dialog"
		aria-modal="true"
		aria-label="Пометка"
	>
		<button
			type="button"
			class="absolute inset-0"
			aria-label="Закрыть"
			onclick={() => (editing = null)}
		></button>
		<div
			class="r-panel relative flex w-full max-w-md flex-col gap-3 rounded-t-box border p-4 shadow-2xl sm:rounded-box"
		>
			{#if editing.text}
				<blockquote
					class="line-clamp-4 border-l-4 pl-3 text-sm"
					style="border-color:{colorHex(editColor)}"
				>
					«{editing.text}»
				</blockquote>
			{:else}
				<p class="text-sm font-semibold">
					Закладка{editing.chapter ? ` · ${editing.chapter}` : ''}
				</p>
			{/if}
			{#if editing.kind === 'highlight'}
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Цвет">
					{#each HIGHLIGHT_COLORS as c, i (c.hex)}
						<button
							type="button"
							role="radio"
							aria-checked={editColor === i}
							class={['r-dot', editColor === i && 'on']}
							style="background:{c.hex}"
							aria-label={c.name}
							title={c.name}
							onclick={() => (editColor = i)}
						></button>
					{/each}
				</div>
			{/if}
			<textarea
				class="r-input min-h-28 w-full"
				maxlength="5000"
				placeholder="Заметка — видна только вам"
				bind:value={editNote}></textarea>
			<div class="flex flex-wrap justify-between gap-2">
				<button type="button" class="r-btn r-outline" onclick={() => editing && removeMark(editing)}
					>Удалить</button
				>
				<div class="flex gap-2">
					<button type="button" class="r-btn" onclick={() => (editing = null)}>Отмена</button>
					<button type="button" class="r-btn r-primary" onclick={saveEditor}>Сохранить</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<dialog bind:this={footnoteDialog} class="modal">
	<div class="reader modal-box p-0" style={vars}>
		<div bind:this={footnoteHost} class="h-64 max-h-[60vh]"></div>
		<form method="dialog" class="border-t p-3 text-right">
			<button class="r-btn r-outline">Закрыть</button>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop"><button>Закрыть</button></form>
</dialog>

<style>
	/* Интерфейс читалки — в цветах темы книги (--r-*), а не темы сайта. */
	.reader {
		z-index: 60;
		background: var(--r-bg);
		color: var(--r-fg);
		color-scheme: light;
	}
	.reader :global(.border-b),
	.reader :global(.border-t),
	.reader :global(.border-r),
	.reader :global(.border) {
		border-color: var(--r-line);
	}
	.r-muted {
		color: var(--r-muted);
	}
	.r-panel {
		background: var(--r-bg);
		color: var(--r-fg);
		border-color: var(--r-line);
	}
	.r-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 2.25rem;
		padding: 0 0.625rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--r-fg);
		background: transparent;
	}
	.r-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--r-fg) 10%, transparent);
	}
	.r-btn:disabled {
		opacity: 0.35;
	}
	.r-outline {
		border: 1px solid var(--r-line);
	}
	.r-primary {
		background: var(--r-accent);
		color: #fff;
	}
	.r-seg {
		display: flex;
		align-items: center;
		border: 1px solid var(--r-line);
		border-radius: 0.5rem;
		overflow: hidden;
	}
	.r-seg > * {
		flex: 1;
		padding: 0.375rem 0.625rem;
		font-size: 0.8125rem;
		text-align: center;
		color: var(--r-fg);
	}
	.r-seg > button:hover:not(:disabled) {
		background: color-mix(in oklab, var(--r-fg) 8%, transparent);
	}
	.r-seg > button:disabled {
		opacity: 0.35;
	}
	.r-seg > button.on {
		background: var(--r-accent);
		color: #fff;
	}
	.r-swatch {
		flex: 1;
		padding: 0.5rem 0;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid var(--r-line);
	}
	.r-swatch.on {
		outline: 2px solid var(--r-accent);
		outline-offset: 1px;
	}
	.r-toc {
		display: block;
		width: 100%;
		padding-top: 0.4rem;
		padding-bottom: 0.4rem;
		padding-right: 0.75rem;
		border-radius: 0.375rem;
		text-align: left;
		font-size: 0.875rem;
		line-height: 1.3;
		color: var(--r-fg);
	}
	.r-toc:hover {
		background: color-mix(in oklab, var(--r-fg) 8%, transparent);
	}
	.r-toc-on {
		color: var(--r-accent);
		font-weight: 600;
	}
	/* Тонкая полоса без стрелок (стандартное свойство: со scrollbar-width Chromium не рисует кнопки). */
	.r-scroll {
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--r-fg) 25%, transparent) transparent;
	}
	.r-on {
		color: var(--r-accent);
	}
	.r-btn-sm {
		min-height: 1.75rem;
		padding: 0 0.4rem;
		font-size: 0.75rem;
	}
	.r-dot {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		border: 2px solid color-mix(in oklab, var(--r-fg) 15%, transparent);
	}
	.r-dot.on {
		outline: 2px solid var(--r-fg);
		outline-offset: 2px;
	}
	.r-mark {
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem 0.25rem 0.5rem 0.625rem;
		border-left: 4px solid var(--mark);
		border-radius: 0.375rem;
	}
	.r-mark:hover {
		background: color-mix(in oklab, var(--r-fg) 6%, transparent);
	}
	.r-input {
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--r-line);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--r-fg);
		font-size: 0.875rem;
	}
	.r-range {
		accent-color: var(--r-accent);
	}
</style>
