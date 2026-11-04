<script lang="ts">
	import { ApiError, errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { getNote, NOTE_LIMIT, putNote, removeNote, type Note } from '#lib/social/notes.ts';

	// «Моя заметка» — личная запись о произведении: её не видит никто, кроме автора, в отличие от
	// рецензии. Нужна для себя: «посмотреть перед второй частью», «советовал Паша». Грузится в
	// браузере с токеном (страница карточки статическая), у гостя блока нет вовсе.
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

{#if session.status === 'authed' && loaded}
	<section id="note" class="mb-12 scroll-mt-32 md:scroll-mt-28" aria-labelledby="note-title">
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
			<h2 id="note-title" class="text-2xl font-bold">
				Моя заметка
				<!-- Прямо в заголовке, а не в подсказке: человек должен знать это до того, как начнёт
				     писать, иначе доверия к полю нет. -->
				<span class="ml-1 text-sm font-normal text-base-content/40">видно только вам</span>
			</h2>
			{#if note && !editing}
				<div class="flex items-center gap-3 text-sm">
					<button class="link text-primary link-hover" onclick={start}>Изменить</button>
					{#if confirmDelete}
						<button class="link text-error link-hover" disabled={busy} onclick={remove}
							>Удалить</button
						>
						<button
							class="link text-base-content/60 link-hover"
							onclick={() => (confirmDelete = false)}>Отмена</button
						>
					{:else}
						<button
							class="link text-base-content/60 link-hover"
							onclick={() => (confirmDelete = true)}>Удалить</button
						>
					{/if}
				</div>
			{/if}
		</div>

		<div class="rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:p-6">
			{#if editing}
				<form class="flex flex-col gap-3" onsubmit={save} aria-label="Моя заметка">
					<textarea
						class="textarea min-h-28 w-full"
						maxlength={NOTE_LIMIT}
						placeholder="Для себя: с чего начать, на что обратить внимание, кто советовал"
						bind:value={draft}></textarea>
					<div class="flex flex-wrap items-center gap-3">
						<button class="btn btn-primary btn-sm" disabled={busy || !draft.trim()}
							>Сохранить</button
						>
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
				<p class="whitespace-pre-line text-base-content/90">{note.body}</p>
			{:else}
				<button
					class="w-full text-left text-base-content/50 transition-colors hover:text-base-content"
					onclick={start}>Записать что-то для себя…</button
				>
			{/if}
			{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
		</div>
	</section>
{/if}
