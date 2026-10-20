<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { chat, type Item, type Message } from '#lib/chat/chat.svelte.ts';
	import { authorName, MAX_BODY, shortTime } from '#lib/chat/rooms.ts';
	import Avatar from '#lib/components/Avatar.svelte';

	// Сообщение ленты: цитата ответа, «изменено», своё — правка и удаление, неотправленное —
	// «повторить». Админ может удалить любое.
	let { item, quoted }: { item: Item; quoted: Message | null | undefined } = $props();

	const mine = $derived(!!item.author && item.author.id === session.user?.id);
	const canDelete = $derived(
		!item.clientId && !item.deleted && (mine || session.user?.role === 'admin')
	);
	let editing = $state(false);
	let draft = $state('');
	let error = $state('');
	let busy = $state(false);

	// «Повторить» после «слишком часто» — когда сервер разрешит.
	let now = $state(Date.now());
	$effect(() => {
		if (!item.retryAt) return;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const wait = $derived(item.retryAt ? Math.ceil((item.retryAt - now) / 1000) : 0);

	async function save() {
		busy = true;
		error = '';
		try {
			await chat.edit(item.id, draft);
			editing = false;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		error = '';
		try {
			await chat.remove(item.id);
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<article class={['group flex gap-2 px-3 py-1.5', { 'opacity-60': item.status === 'sending' }]}>
	{#if item.author}
		<Avatar user={item.author} />
	{:else}
		<span class="size-8 shrink-0 rounded-full bg-base-300" aria-hidden="true"></span>
	{/if}
	<div class="min-w-0 flex-1">
		<p class="flex items-baseline gap-2 text-xs">
			<span class="truncate font-bold">{item.author ? authorName(item.author) : 'Удалено'}</span>
			<time class="text-base-content/40" datetime={item.created_at}
				>{shortTime(item.created_at)}</time
			>
			{#if item.edited_at && !item.deleted}<span class="text-base-content/40">изменено</span>{/if}
		</p>

		{#if item.reply_to}
			<p class="mt-0.5 truncate border-l-2 border-primary/60 pl-2 text-xs text-base-content/50">
				{#if quoted && !quoted.deleted}
					<b>{quoted.author ? authorName(quoted.author) : ''}</b> {quoted.body}
				{:else if quoted}
					Сообщение удалено
				{:else}
					Ответ на сообщение
				{/if}
			</p>
		{/if}

		{#if item.deleted}
			<p class="text-sm text-base-content/40 italic">Сообщение удалено</p>
		{:else if editing}
			<form
				class="mt-1"
				onsubmit={(e) => {
					e.preventDefault();
					void save();
				}}
			>
				<textarea
					class="textarea w-full textarea-sm"
					rows="2"
					maxlength={MAX_BODY}
					bind:value={draft}
					aria-label="Текст сообщения"
					onkeydown={(e) => {
						if (e.key === 'Escape') editing = false;
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							void save();
						}
					}}></textarea>
				<div class="mt-1 flex gap-2">
					<button class="btn btn-primary btn-xs" disabled={busy || !draft.trim()}>Сохранить</button>
					<button type="button" class="btn btn-ghost btn-xs" onclick={() => (editing = false)}
						>Отмена</button
					>
				</div>
			</form>
		{:else}
			<p class="text-sm break-words whitespace-pre-wrap">{item.body}</p>
		{/if}

		{#if item.status === 'failed'}
			<p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-error" role="alert">
				Не отправлено: {item.error}
				<button class="link" disabled={wait > 0} onclick={() => chat.retry(item.clientId!)}
					>{wait > 0 ? `повторить через ${wait} с` : 'повторить'}</button
				>
				<button class="link text-base-content/50" onclick={() => chat.discard(item.clientId!)}
					>убрать</button
				>
			</p>
		{/if}
		{#if error}<p class="mt-1 text-xs text-error" role="alert">{error}</p>{/if}
	</div>

	{#if !item.clientId && !item.deleted && !editing && session.status === 'authed'}
		<div
			class="flex shrink-0 items-start gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100"
		>
			<button
				class="btn btn-ghost btn-xs"
				title="Ответить"
				aria-label="Ответить"
				onclick={() => (chat.replyTo = item)}>↩</button
			>
			{#if mine}
				<button
					class="btn btn-ghost btn-xs"
					title="Изменить"
					aria-label="Изменить"
					onclick={() => {
						draft = item.body ?? '';
						editing = true;
					}}>✎</button
				>
			{/if}
			{#if canDelete}
				<button class="btn btn-ghost btn-xs" title="Удалить" aria-label="Удалить" onclick={remove}
					>✕</button
				>
			{/if}
		</div>
	{/if}
</article>
