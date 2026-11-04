<script lang="ts">
	import { ApiError, errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
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
			<form
				class="flex flex-col gap-3 rounded-box bg-warning/5 p-4 ring-1 ring-warning/20"
				onsubmit={save}
				aria-label="Моя заметка"
			>
				<p class="flex items-center gap-2 text-xs text-base-content/50">
					{@render lock()} Заметка для себя · видно только вам
				</p>
				<textarea
					class="textarea min-h-28 w-full bg-base-100"
					maxlength={NOTE_LIMIT}
					placeholder="С чего начать, на что обратить внимание, кто советовал"
					bind:value={draft}></textarea>
				<div class="flex flex-wrap items-center gap-3">
					<button class="btn btn-primary btn-sm" disabled={busy || !draft.trim()}>Сохранить</button>
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						disabled={busy}
						onclick={() => (editing = false)}>Отмена</button
					>
					<span class="ml-auto text-xs text-base-content/40">
						{draft.length.toLocaleString('ru-RU')} / {NOTE_LIMIT.toLocaleString('ru-RU')}
					</span>
				</div>
			</form>
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
				<p class="whitespace-pre-line text-base-content/90">{note.body}</p>
			</div>
		{:else}
			<!-- Пусто — одна строка, а не блок: предлагаем, но не занимаем экран. -->
			<button
				class="group flex w-full items-center gap-2 rounded-box px-1 py-2 text-left text-sm text-base-content/45 transition-colors hover:text-base-content/80"
				onclick={start}
			>
				{@render lock()}
				<span>Заметка для себя — видно только вам</span>
				<span class="ml-auto text-primary opacity-0 transition-opacity group-hover:opacity-100"
					>Добавить</span
				>
			</button>
		{/if}
		{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
	</section>
{/if}
