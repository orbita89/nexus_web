<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaUserRef } from '#lib/api/generated/social.ts';
	import { unwrap } from '#lib/api/errors.ts';
	import { guestApi, session } from '#lib/auth/session.svelte.ts';
	import { authorName } from '#lib/chat/rooms.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// Поиск людей из шапки панели: найти человека и перейти к нему. Личные переписки
	// появятся вместе с бэкендом (PUT /users/{username}/dm) — тогда здесь встанет «Написать».
	let { onclose }: { onclose: () => void } = $props();

	let query = $state('');
	let found = $state<SchemaUserRef[]>([]);
	let searching = $state(false);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let field = $state<HTMLInputElement>();

	$effect(() => field?.focus());

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) {
			found = [];
			failed = false;
			return;
		}
		timer = setTimeout(async () => {
			searching = true;
			try {
				const users = await unwrap(
					guestApi.social.GET('/api/v1/social/users', { params: { query: { q, limit: 20 } } })
				);
				if (q === query.trim()) found = users;
				failed = false;
			} catch {
				found = [];
				failed = true;
			} finally {
				searching = false;
			}
		}, 250);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class="flex items-center gap-2 px-4 pt-1 pb-2">
		<label class="input min-w-0 flex-1 input-sm">
			<input
				bind:this={field}
				type="search"
				placeholder="Найти человека"
				aria-label="Найти человека"
				autocomplete="off"
				bind:value={query}
				oninput={onInput}
				onkeydown={(e) => e.key === 'Escape' && onclose()}
			/>
			{#if searching}<span class="loading loading-xs loading-spinner"></span>{/if}
		</label>
		<button class="btn shrink-0 btn-ghost btn-sm" onclick={onclose}>Закрыть</button>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
		{#if failed}
			<p role="alert" class="px-2 py-4 text-sm text-error">Поиск сейчас недоступен.</p>
		{:else if query.trim().length < 2}
			<p class="px-2 py-6 text-sm text-base-content/60">
				Введите имя или логин — хотя бы два символа.
			</p>
		{:else if found.length}
			<ul>
				{#each found as user (user.id)}
					<li>
						<a
							href="/u/{user.username}"
							class="flex items-center gap-3 rounded-box px-2 py-2 transition hover:bg-base-300/60"
							onclick={onclose}
						>
							<Avatar {user} size="w-10" />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-bold">{authorName(user)}</span>
								<span class="block truncate text-xs text-base-content/50">@{user.username}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else if !searching}
			<p class="px-2 py-6 text-sm text-base-content/60">Никого не нашлось.</p>
		{/if}

		{#if session.status === 'guest'}
			<p class="px-2 py-4 text-xs text-base-content/50">
				<a href={loginUrl(page.url)} class="link link-primary">Войдите</a>, чтобы писать людям.
			</p>
		{/if}
	</div>
</div>
