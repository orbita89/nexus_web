<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session, updateUser } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AvatarUpload from '#lib/components/AvatarUpload.svelte';

	const USERNAME_CHANGE_DAYS = 30;
	const BIO_LIMIT = 1000;
	const user = session.user!;

	let username = $state(user.username);
	let displayName = $state(user.display_name ?? '');
	let bio = $state(user.bio ?? '');
	let statsPublic = $state(user.stats_public);
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
		// avatar_url здесь не шлём: фото ставится отдельным запросом, а свой avatar_url в PATCH
		// удалил бы загруженный файл.
		const body: {
			username?: string;
			display_name?: string;
			bio?: string | null;
			stats_public?: boolean;
		} = {};
		if (username.trim() !== current.username) body.username = username.trim();
		if (displayName.trim() !== (current.display_name ?? '')) body.display_name = displayName.trim();
		// Пустая строка очищает «о себе» — так же, как null.
		if (bio.trim() !== (current.bio ?? '')) body.bio = bio.trim();
		if (statsPublic !== current.stats_public) body.stats_public = statsPublic;
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

<div class="flex flex-col gap-6">
	<AvatarUpload />

	<form class="flex flex-col gap-4" onsubmit={submit}>
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
			<legend class="fieldset-legend">О себе</legend>
			<textarea
				class="textarea h-28 w-full"
				name="bio"
				maxlength={BIO_LIMIT}
				placeholder="Смотрю фантастику, читаю Стругацких…"
				bind:value={bio}></textarea>
			<p class="label text-wrap">
				Видно всем в профиле. Осталось {BIO_LIMIT - bio.length} символов.
			</p>
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Статистика</legend>
			<label class="label cursor-pointer justify-start gap-3 text-wrap">
				<input
					type="checkbox"
					class="toggle toggle-primary"
					name="stats_public"
					bind:checked={statsPublic}
				/>
				<span>Показывать мою статистику всем</span>
			</label>
			<p class="label text-wrap">
				Оценки, отметки «посмотреть позже» и «просмотрено», комментарии и сводка. Пока выключено, их
				видите только вы.
			</p>
		</fieldset>

		{#if error}<Alert>{error}</Alert>{/if}
		{#if saved}<Alert kind="success">Сохранено.</Alert>{/if}
		<div><button class="btn btn-primary" disabled={submitting}>Сохранить</button></div>
	</form>
</div>
