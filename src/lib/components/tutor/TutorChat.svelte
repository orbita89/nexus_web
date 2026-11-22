<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, authedFetch } from '#lib/auth/session.svelte.ts';
	import Markdown from '#lib/components/social/Markdown.svelte';
	import {
		NoProviderError,
		ask,
		createThread,
		deleteThread,
		getThread,
		listBookThreads,
		type AiMessage,
		type AiThread
	} from '#lib/tutor/api.ts';

	// Чат с ИИ-преподавателем по книге: список своих обсуждений книги, сообщения, вопрос — ответ
	// потоком. Вопрос из читалки приходит с выделенным фрагментом (quote) и главой. Всё — по API
	// на своём ключе пользователя; нет ключа — ведём в настройки.
	let {
		slug,
		threadId = null,
		quote = null,
		chapter = null,
		fraction = null,
		onquoteclear
	}: {
		slug: string;
		/** Открыть это обсуждение (из профиля); иначе — последнее или новое. */
		threadId?: string | null;
		/** Фрагмент из читалки: к нему относится следующий вопрос. */
		quote?: string | null;
		chapter?: string | null;
		/** Докуда дочитал читатель — чтобы ИИ не спойлерил. */
		fraction?: number | null;
		onquoteclear?: () => void;
	} = $props();

	const SUGGESTIONS = [
		'В чём главный смысл книги?',
		'Чем закончилась книга? (спойлер)',
		'Какие ключевые темы и символы?',
		'Расскажи о контексте эпохи'
	];

	let threads = $state<AiThread[]>([]);
	let current = $state<string | null>(null);
	let messages = $state<AiMessage[]>([]);
	let text = $state('');
	let streaming = $state('');
	let busy = $state(false);
	let error = $state('');
	let noProvider = $state(false);
	let loading = $state(true);
	let list = $state<HTMLDivElement>();
	let controller: AbortController | null = null;

	const thread = $derived(threads.find((t) => t.id === current));

	async function scrollDown() {
		await tick();
		list?.scrollTo({ top: list.scrollHeight });
	}

	async function open(id: string | null) {
		current = id;
		messages = [];
		error = '';
		if (!id) return;
		try {
			const detail = await getThread(api, id);
			if (current !== id) return;
			messages = detail.messages;
			await scrollDown();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	onMount(() => {
		(async () => {
			try {
				threads = await listBookThreads(api, slug);
				// Вопрос по фрагменту — новое обсуждение; иначе — указанное или последнее.
				const start = quote ? null : (threadId ?? threads[0]?.id ?? null);
				await open(start);
			} catch (e) {
				error = errorMessage(e);
			} finally {
				loading = false;
			}
		})();
		return () => controller?.abort();
	});

	async function send(question = text) {
		const q = question.trim();
		if (!q || busy) return;
		busy = true;
		error = '';
		noProvider = false;
		try {
			let id = current;
			if (!id) {
				const created = await createThread(api, slug);
				threads = [created, ...threads];
				id = current = created.id;
			}
			const usedQuote = quote;
			messages = [
				...messages,
				{
					id: `local-${Date.now()}`,
					role: 'user',
					content: q,
					quote: usedQuote,
					chapter,
					created_at: new Date().toISOString()
				}
			];
			text = '';
			streaming = '';
			await scrollDown();
			controller = new AbortController();
			const answerId = await ask(
				authedFetch,
				id,
				{ text: q, quote: usedQuote, chapter, fraction },
				(delta) => {
					streaming += delta;
					void scrollDown();
				},
				controller.signal
			);
			messages = [
				...messages,
				{
					id: answerId,
					role: 'assistant',
					content: streaming,
					quote: null,
					chapter: null,
					created_at: new Date().toISOString()
				}
			];
			streaming = '';
			if (usedQuote) onquoteclear?.();
			// Название и счётчики обновились на сервере.
			threads = await listBookThreads(api, slug).catch(() => threads);
		} catch (e) {
			if (e instanceof NoProviderError) noProvider = true;
			else if (!(e instanceof DOMException && e.name === 'AbortError')) error = errorMessage(e);
			streaming = '';
		} finally {
			busy = false;
			controller = null;
		}
	}

	async function remove() {
		if (!current) return;
		const id = current;
		try {
			await deleteThread(api, id);
			threads = threads.filter((t) => t.id !== id);
			await open(threads[0]?.id ?? null);
		} catch (e) {
			error = errorMessage(e);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}
</script>

<div class="flex h-full min-h-0 flex-col">
	<div class="flex flex-wrap items-center gap-2 border-b border-base-300 p-2">
		<select
			class="select min-w-0 flex-1 select-sm"
			aria-label="Обсуждение"
			value={current ?? ''}
			disabled={busy || loading}
			onchange={(e) => open(e.currentTarget.value || null)}
		>
			<option value="">Новое обсуждение</option>
			{#each threads as t (t.id)}
				<option value={t.id}>{t.title}</option>
			{/each}
		</select>
		{#if current}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				disabled={busy}
				title="Удалить обсуждение"
				onclick={remove}>Удалить</button
			>
		{/if}
	</div>

	<div bind:this={list} class="min-h-0 flex-1 overflow-y-auto p-3" aria-live="polite">
		{#if loading}
			<div class="flex justify-center py-10"><span class="loading loading-spinner"></span></div>
		{:else if !messages.length && !streaming}
			<p class="mb-3 text-sm text-base-content/60">
				Спросите о книге: смысл, герои, эпоха, непонятное место. Ответы — по вашему ключу ИИ, видны
				только вам.
			</p>
			{#if !quote}
				<div class="flex flex-wrap gap-2">
					{#each SUGGESTIONS as s (s)}
						<button type="button" class="btn btn-sm" disabled={busy} onclick={() => send(s)}
							>{s}</button
						>
					{/each}
				</div>
			{/if}
		{/if}
		<ul class="flex flex-col gap-3">
			{#each messages as m (m.id)}
				<li class={['flex', m.role === 'user' ? 'justify-end' : 'justify-start']}>
					<div
						class={[
							'max-w-[85%] rounded-box px-3 py-2 text-sm',
							m.role === 'user' ? 'bg-primary/15' : 'bg-base-200'
						]}
					>
						{#if m.quote}
							<blockquote
								class="mb-1 border-l-2 border-primary/60 pl-2 text-xs text-base-content/60"
							>
								{#if m.chapter}<span class="block font-semibold">{m.chapter}</span>{/if}
								<span class="line-clamp-4">«{m.quote}»</span>
							</blockquote>
						{/if}
						{#if m.role === 'assistant'}
							<Markdown text={m.content} />
						{:else}
							<p class="whitespace-pre-line">{m.content}</p>
						{/if}
					</div>
				</li>
			{/each}
			{#if busy}
				<li class="flex justify-start">
					<div class="max-w-[85%] rounded-box bg-base-200 px-3 py-2 text-sm">
						{#if streaming}<Markdown text={streaming} />{:else}<span
								class="loading loading-xs loading-dots"
							></span>{/if}
					</div>
				</li>
			{/if}
		</ul>
	</div>

	{#if noProvider}
		<div role="alert" class="m-2 alert alert-soft text-sm alert-warning">
			<span
				>Чтобы обсуждать книги с ИИ, добавьте свой ключ (OpenAI, DeepSeek, Claude и другие) в
				настройках.</span
			>
			<a href="/settings/ai" class="btn btn-sm">Добавить ключ</a>
		</div>
	{/if}
	{#if error}
		<p role="alert" class="mx-2 mb-1 text-sm text-error">{error}</p>
	{/if}

	<form
		class="flex flex-col gap-2 border-t border-base-300 p-2"
		onsubmit={(e) => {
			e.preventDefault();
			void send();
		}}
	>
		{#if quote}
			<div class="flex items-start gap-2 rounded-box bg-base-200 p-2 text-xs">
				<span class="line-clamp-3 flex-1 text-base-content/70"
					>{chapter ? `${chapter}: ` : ''}«{quote}»</span
				>
				{#if onquoteclear}
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						aria-label="Убрать фрагмент"
						onclick={onquoteclear}>✕</button
					>
				{/if}
			</div>
		{/if}
		<div class="flex items-end gap-2">
			<textarea
				class="textarea min-h-10 flex-1 textarea-sm"
				rows="2"
				maxlength="2000"
				placeholder={quote ? 'Что непонятно в этом фрагменте?' : 'Ваш вопрос о книге'}
				bind:value={text}
				onkeydown={onKeydown}
				disabled={loading}></textarea>
			{#if busy}
				<button type="button" class="btn btn-sm" onclick={() => controller?.abort()}>Стоп</button>
			{:else}
				<button class="btn btn-primary btn-sm" disabled={!text.trim() || loading}>Спросить</button>
			{/if}
		</div>
		{#if thread}
			<p class="text-right text-[0.7rem] text-base-content/40">
				токенов: {thread.tokens_in.toLocaleString('ru')} вход · {thread.tokens_out.toLocaleString(
					'ru'
				)} ответ
			</p>
		{/if}
	</form>
</div>
