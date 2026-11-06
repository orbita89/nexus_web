<script lang="ts">
	import { ApiError, errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import Markdown from '#lib/components/social/Markdown.svelte';
	import { noteComposer } from '#lib/social/note.svelte.ts';
	import { getNote, NOTE_LIMIT, putNote, removeNote, type Note } from '#lib/social/notes.ts';

	// «Моя заметка» — личная запись о произведении: её не видит никто, кроме автора. Пока заметки
	// нет, это одна негромкая строка с замком, а не раздел с заголовком и пустой плашкой во весь
	// экран: до того, как человек что-то написал, показывать нечего. Есть текст — карточка в тёплом
	// оттенке, чтобы она не смешивалась с публичными блоками рядом.
	let { slug }: { slug: string } = $props();

	let note = $state<Note | null>(null);
	let loaded = $state(false);
	let editing = $state(false);
	let draft = $state('');
	let busy = $state(false);
	let error = $state('');
	let confirmDelete = $state(false);

	$effect(() => {
		const current = slug;
		note = null;
		editing = false;
		error = '';
		loaded = session.status === 'guest';
		if (session.status !== 'authed') return;
		let stale = false;
		getNote(api, current)
			.then((n) => !stale && (note = n))
			.catch((e) => {
				// 404 — заметки просто нет, это обычное состояние.
				if (!stale && !(e instanceof ApiError && e.status === 404)) error = errorMessage(e);
			})
			.finally(() => !stale && (loaded = true));
		return () => {
			stale = true;
		};
	});

	function start() {
		draft = note?.body ?? '';
		confirmDelete = false;
		error = '';
		editing = true;
	}

	// Редактор открывают и отсюда, и из панели «Оценить» в шапке — через общее состояние.
	$effect(() => {
		if (noteComposer.open && !editing) {
			start();
			noteComposer.open = false;
		}
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const body = draft.trim();
		if (!body || busy) return;
		busy = true;
		error = '';
		try {
			note = await putNote(api, slug, body);
			editing = false;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		busy = true;
		error = '';
		try {
			await removeNote(api, slug);
			note = null;
			editing = false;
			confirmDelete = false;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

{#snippet lock()}
	<svg
		class="size-4 shrink-0 text-warning/70"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg
	>
{/snippet}

{#if session.status === 'authed' && loaded}
	<section id="note" class="mb-12 scroll-mt-32 md:scroll-mt-28" aria-label="Моя заметка">
		{#if editing}
			<!-- Градиентная рамка в один пиксель и мягкое свечение: заметка — личный блок, и он
			     должен выделяться среди публичных плашек, оставаясь спокойным. Приём обычный:
			     внешний слой — градиент, внутренний — фон страницы поверх него. -->
			<div
				class="rounded-2xl bg-linear-to-r from-primary via-warning to-secondary p-px shadow-[0_0_45px_-18px] shadow-primary/60"
			>
				<form
					class="flex flex-col gap-4 rounded-[calc(1rem-1px)] bg-base-100 p-4 sm:p-5"
					onsubmit={save}
					aria-label="Моя заметка"
				>
					<p class="flex items-center gap-2 text-xs text-warning/80">
						{@render lock()} Заметка для себя • видно только вам
					</p>
					<!-- Поле без своего фона и рамки: рамка держит всю карточку, внутри — только текст. -->
					<textarea
						class="min-h-24 w-full resize-y bg-transparent text-lg leading-relaxed font-medium placeholder:font-normal placeholder:text-base-content/30 focus:outline-none"
						maxlength={NOTE_LIMIT}
						placeholder="С чего начать, на что обратить внимание, кто советовал"
						bind:value={draft}></textarea>
					<div class="flex flex-wrap items-center gap-3">
						<button
							class="rounded-full bg-linear-to-r from-primary to-warning px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
							disabled={busy || !draft.trim()}>Сохранить</button
						>
						<!-- Без класса btn: у него своя заливка, и «Отмена» получалась серой плашкой
							 рядом с градиентной кнопкой. Здесь это просто текст. -->
						<button
							type="button"
							class="rounded-full px-3 py-1.5 text-sm font-semibold text-base-content/60 transition-colors hover:bg-base-content/5 hover:text-base-content disabled:opacity-40"
							disabled={busy}
							onclick={() => (editing = false)}>Отмена</button
						>
						<!-- Счётчик кольцом: сколько места занято, видно и не читая цифр. -->
						<span class="ml-auto flex items-center gap-2 text-xs text-base-content/40">
							<svg class="size-4 -rotate-90" viewBox="0 0 20 20" aria-hidden="true">
								<circle
									cx="10"
									cy="10"
									r="8"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									class="text-base-content/15"
								/>
								<circle
									cx="10"
									cy="10"
									r="8"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									class="text-warning transition-[stroke-dashoffset] duration-300"
									stroke-dasharray="50.3"
									stroke-dashoffset={50.3 * (1 - Math.min(1, draft.length / NOTE_LIMIT))}
								/>
							</svg>
							{draft.length.toLocaleString('ru-RU')} / {NOTE_LIMIT.toLocaleString('ru-RU')}
						</span>
					</div>
				</form>
			</div>
		{:else if note}
			<div class="rounded-box bg-warning/5 p-4 ring-1 ring-warning/20">
				<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
					<p class="flex items-center gap-2 text-xs text-base-content/50">
						{@render lock()} Заметка для себя · видно только вам
					</p>
					<div class="ml-auto flex items-center gap-3 text-xs">
						<button class="link text-primary link-hover" onclick={start}>Изменить</button>
						{#if confirmDelete}
							<button class="link text-error link-hover" disabled={busy} onclick={remove}
								>Удалить</button
							>
							<button
								class="link text-base-content/50 link-hover"
								onclick={() => (confirmDelete = false)}>Отмена</button
							>
						{:else}
							<button
								class="link text-base-content/50 link-hover"
								onclick={() => (confirmDelete = true)}>Удалить</button
							>
						{/if}
					</div>
				</div>
				<Markdown text={note.body} class="text-base-content/90" />
			</div>
		{:else}
			<!-- Пусто — одна строка, а не блок. Но это именно кнопка с рамкой и плюсом: прежняя
			     серая надпись выглядела подписью, и что сюда можно писать, никто не понимал. -->
			<button
				class="flex w-full items-center gap-2 rounded-box border border-dashed border-base-content/15 px-4 py-3 text-left text-sm text-base-content/60 transition-colors hover:border-warning/40 hover:bg-warning/5 hover:text-base-content"
				onclick={start}
			>
				<span class="text-lg leading-none text-warning/70" aria-hidden="true">+</span>
				{@render lock()}
				<span>Добавить заметку для себя — видно только вам</span>
			</button>
		{/if}
		{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
	</section>
{/if}
