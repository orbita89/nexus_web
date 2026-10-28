<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaDmPolicy, SchemaUserRef } from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { authorName } from '#lib/chat/rooms.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';

	// Личные сообщения: кто может написать первым и кого я заблокировал.
	const POLICIES: { value: SchemaDmPolicy; title: string; hint: string }[] = [
		{ value: 'all', title: 'Кто угодно', hint: 'Любой вошедший с подтверждённым email.' },
		{ value: 'following', title: 'Только мои подписки', hint: 'Те, на кого подписан я.' },
		{ value: 'none', title: 'Никто', hint: 'Писать первым не сможет никто.' }
	];

	let policy = $state<SchemaDmPolicy | null>(null);
	let blocked = $state<SchemaUserRef[] | null>(null);
	let error = $state('');
	let busy = $state('');

	async function load() {
		try {
			policy = (await unwrap(api.social.GET('/api/v1/social/users/me/chat-settings'))).dm_policy;
			blocked = (await unwrap(api.social.GET('/api/v1/social/users/blocked'))).items;
		} catch (e) {
			error = errorMessage(e);
		}
	}
	void load();

	async function setPolicy(value: SchemaDmPolicy) {
		const previous = policy;
		policy = value;
		busy = 'policy';
		error = '';
		try {
			await unwrap(
				api.social.PATCH('/api/v1/social/users/me/chat-settings', { body: { dm_policy: value } })
			);
		} catch (e) {
			policy = previous;
			error = errorMessage(e);
		} finally {
			busy = '';
		}
	}

	async function unblock(username: string) {
		busy = username;
		error = '';
		try {
			await unwrap(
				api.social.DELETE('/api/v1/social/users/{username}/block', {
					params: { path: { username } }
				})
			);
			blocked = (blocked ?? []).filter((u) => u.username !== username);
			void chat.loadChats();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = '';
		}
	}
</script>

<svelte:head><title>Личные сообщения — Настройки — Кассандра</title></svelte:head>

<h2 class="mb-4 text-xl font-bold">Личные сообщения</h2>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

<fieldset class="mb-8 flex flex-col gap-2">
	<legend class="mb-2 font-medium">Кто может написать мне первым</legend>
	{#if !policy}
		<span class="h-20 skeleton"></span>
	{:else}
		{#each POLICIES as option (option.value)}
			<label class="flex cursor-pointer items-start gap-3 rounded-box bg-base-200 p-3">
				<input
					type="radio"
					class="radio mt-0.5 radio-sm"
					name="dm-policy"
					checked={policy === option.value}
					disabled={busy === 'policy'}
					onchange={() => setPolicy(option.value)}
				/>
				<span>
					<span class="block font-medium">{option.title}</span>
					<span class="block text-sm text-base-content/60">{option.hint}</span>
				</span>
			</label>
		{/each}
		<p class="text-sm text-base-content/60">
			Запрет не касается уже начатых переписок — в них вам по-прежнему смогут ответить.
		</p>
	{/if}
</fieldset>

<h3 class="mb-2 font-medium">Заблокированные</h3>
{#if !blocked}
	<span class="h-12 skeleton"></span>
{:else if !blocked.length}
	<p class="text-sm text-base-content/60">
		Никого. Заблокировать человека можно в его профиле — он не сможет вам писать.
	</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each blocked as user (user.id)}
			<li class="flex items-center gap-3 rounded-box bg-base-200 p-3">
				<Avatar {user} size="w-10" />
				<a href="/u/{user.username}" class="min-w-0 flex-1 truncate link-hover">
					{authorName(user)}
					<span class="text-base-content/50">@{user.username}</span>
				</a>
				<button
					class="btn btn-ghost btn-sm"
					disabled={busy === user.username}
					onclick={() => unblock(user.username)}>Разблокировать</button
				>
			</li>
		{/each}
	</ul>
{/if}
