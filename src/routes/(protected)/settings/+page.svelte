<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session, updateUser } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';

	const USERNAME_CHANGE_DAYS = 30;
	const user = session.user!;

	let username = $state(user.username);
	let displayName = $state(user.display_name ?? '');
	let avatarUrl = $state(user.avatar_url ?? '');
	let error = $state('');
	let saved = $state(false);
	let submitting = $state(false);

	/** username меняется раз в 30 дней: когда снова можно. */
	const nextUsernameChange = $derived.by(() => {
		const changed = session.user?.username_changed_at;
		if (!changed) return null;
		const next = Date.parse(changed) + USERNAME_CHANGE_DAYS * 24 * 60 * 60 * 1000;
		return next > Date.now() ? new Date(next) : null;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		error = '';
		saved = false;
		const current = session.user!;
		// Отправляем только изменённое: иначе тот же username упрётся в правило 30 дней не зря.
		const body: { username?: string; display_name?: string; avatar_url?: string } = {};
		if (username.trim() !== current.username) body.username = username.trim();
		if (displayName.trim() !== (current.display_name ?? '')) body.display_name = displayName.trim();
		if (avatarUrl.trim() !== (current.avatar_url ?? '')) body.avatar_url = avatarUrl.trim();
		try {
			updateUser(await unwrap(api.auth.PATCH('/api/v1/auth/me', { body })));
			saved = true;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>Профиль — Настройки — Nexus</title></svelte:head>

<form class="flex flex-col gap-4" onsubmit={submit}>
	<div class="flex items-center gap-4">
		<Avatar user={{ username, display_name: displayName, avatar_url: avatarUrl }} size="w-16" />
		<div>
			<div class="font-semibold">{displayName || username}</div>
			<a class="link text-sm link-hover" href="/u/{session.user?.username}">Открыть профиль</a>
		</div>
	</div>

	<fieldset class="fieldset">
		<legend class="fieldset-legend">Имя пользователя</legend>
		<input
			class="input w-full"
			name="username"
			required
			minlength="3"
			maxlength="32"
			pattern="[A-Za-z0-9_.\-]+"
			disabled={nextUsernameChange !== null}
			bind:value={username}
		/>
		<p class="label text-wrap">
			{#if nextUsernameChange}
				Можно сменить после {nextUsernameChange.toLocaleDateString('ru-RU')}.
			{:else}
				Раз в {USERNAME_CHANGE_DAYS} дней. Старые ссылки на профиль перестанут работать.
			{/if}
		</p>
	</fieldset>

	<fieldset class="fieldset">
		<legend class="fieldset-legend">Отображаемое имя</legend>
		<input class="input w-full" name="display_name" maxlength="64" bind:value={displayName} />
	</fieldset>

	<fieldset class="fieldset">
		<legend class="fieldset-legend">Аватар</legend>
		<input
			class="input w-full"
			name="avatar_url"
			type="url"
			pattern="https://.*"
			maxlength="500"
			placeholder="https://…"
			bind:value={avatarUrl}
		/>
		<p class="label">Ссылка на картинку, только https://. Загрузка файлов появится позже.</p>
	</fieldset>

	{#if error}<Alert>{error}</Alert>{/if}
	{#if saved}<Alert kind="success">Сохранено.</Alert>{/if}
	<div><button class="btn btn-primary" disabled={submitting}>Сохранить</button></div>
</form>
