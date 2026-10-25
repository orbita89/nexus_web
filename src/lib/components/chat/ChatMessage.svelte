<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { chat, type Item, type Message } from '#lib/chat/chat.svelte.ts';
	import { authorName, entityLink, MAX_BODY, parseBody, shortTime } from '#lib/chat/rooms.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import MessageCard from './MessageCard.svelte';

	// Сообщение ленты: цитата ответа, «изменено», своё — правка и удаление, неотправленное —
	// «повторить». Админ может удалить любое.
	let { item, quoted }: { item: Item; quoted: Message | null | undefined } = $props();

	const mine = $derived(!!item.author && item.author.id === session.user?.id);
	const canDelete = $derived(
		!item.clientId && !item.deleted && (mine || session.user?.role === 'admin')
	);
	/** Карточка, на которую ссылается сообщение; если кроме ссылки ничего нет — текст не рисуем. */
	const card = $derived(item.body && !item.deleted ? entityLink(item.body) : null);
	const parts = $derived(parseBody(item.body ?? ''));
	const onlyLink = $derived(!!card && parts.length === 1 && !!item.body?.trim().match(/^\S+$/));
	/** Меню по клику на автора: профиль или личное сообщение. Закрывается кликом мимо и Esc. */
	let menu = $state(false);
	let row = $state<HTMLElement>();
	$effect(() => {
		if (!menu) return;
		const away = (e: MouseEvent) => {
			if (!row?.contains(e.target as Node)) menu = false;
		};
		const esc = (e: KeyboardEvent) => e.key === 'Escape' && (menu = false);
		// capture: закрыть до того, как клик куда-то уведёт.
		document.addEventListener('click', away, true);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('click', away, true);
			document.removeEventListener('keydown', esc);
		};
	});
	let writing = $state(false);
	const canWrite = $derived(!mine && session.status === 'authed');

	async function write() {
		if (!item.author) return;
		writing = true;
		try {
			await chat.openDm(item.author);
			menu = false;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			writing = false;
		}
	}

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

<article
	bind:this={row}
	class={['group flex gap-2 px-3 py-1.5', { 'opacity-60': item.status === 'sending', 'flex-row-reverse': mine }]}
>
	{#if !mine && item.author && !item.clientId}
		<button
			class="shrink-0"
			aria-label="{authorName(item.author)} — профиль или написать"
			onclick={() => (menu = !menu)}
		>
			<Avatar user={item.author} />
		</button>
	{:else if item.author}
		<Avatar user={item.author} />
	{:else}
		<span class="size-8 shrink-0 rounded-full bg-base-300" aria-hidden="true"></span>
	{/if}
	<div class={["min-w-0 flex-1 rounded-2xl px-3 py-2", mine ? "bg-[#2b5278] text-white ml-auto max-w-[80%]" : "bg-[#242f3d] text-white max-w-[80%]"]}>
		<p class="flex items-baseline gap-2 text-xs">
			{#if !mine && item.author && !item.clientId}
				<span class="relative min-w-0">
					<button class="truncate font-bold link-hover" onclick={() => (menu = !menu)}
						>{authorName(item.author)}</button
					>
					{#if menu}
						<!-- Клик по имени или аватару: в профиль или сразу написать лично. -->
						<span
							class="absolute top-full left-0 z-30 mt-1 flex w-44 flex-col rounded-box bg-base-100 p-1 shadow-xl ring-1 ring-base-300"
						>
							<a
								href="/u/{item.author.username}"
								class="rounded px-3 py-1.5 text-left text-sm hover:bg-base-300"
								onclick={() => (menu = false)}>Профиль</a
							>
							{#if canWrite}
								<button
									class="rounded px-3 py-1.5 text-left text-sm hover:bg-base-300 disabled:opacity-50"
									disabled={writing}
									onclick={write}>Написать</button
								>
							{/if}
						</span>
					{/if}
				</span>
			{:else}
				<span class="truncate font-bold">{item.author ? authorName(item.author) : 'Удалено'}</span>
			{/if}
			<time class="text-base-content/40" datetime={item.created_at}
				>{shortTime(item.created_at)}</time
			>
			{#if item.edited_at && !item.deleted}<span class="text-base-content/40">изменено</span>{/if}
		</p>

		{#if item.reply_to}
			<p class="mt-0.5 truncate border-l-2 border-primary/60 pl-2 text-xs text-base-content/50">
				{#if quoted && !quoted.deleted}
					{#if quoted.author}
						<a href="/u/{quoted.author.username}" class="font-bold link-hover"
							>{authorName(quoted.author)}</a
						>
					{/if}
					{quoted.body}
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
			{#if item.body && !onlyLink}
				<p class="text-sm break-words whitespace-pre-wrap">
					{#each parts as part, i (i)}{#if part.t === 'mention'}<a
								href="/u/{part.v}"
								class={[
									'link link-primary',
									{ 'rounded bg-primary/15 px-0.5': part.v === session.user?.username }
								]}>@{part.v}</a
							>{:else}{part.v}{/if}{/each}
				</p>
			{/if}
			{#if item.attachment}
				<!-- Место под картинку держим по размерам с сервера: лента не прыгает при загрузке. -->
				<a
					href={item.attachment.url}
					target="_blank"
					rel="noreferrer"
					class="mt-1 block w-fit overflow-hidden rounded-box bg-base-300/40"
					style="aspect-ratio: {item.attachment.width} / {item.attachment
						.height}; max-width: min(100%, {item.attachment.width}px)"
				>
					<img
						src={item.attachment.url}
						alt="Картинка в сообщении"
						width={item.attachment.width}
						height={item.attachment.height}
						loading="lazy"
						decoding="async"
						class="h-full w-full object-cover"
					/>
				</a>
			{/if}
			{#if card}
				<MessageCard link={card} />
			{/if}
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
