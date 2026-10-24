<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import { AVATAR_ACCEPT, avatarFileError, deleteAvatar, uploadAvatar } from '#lib/auth/avatar.ts';
	import { api, session, updateUser } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';

	// Фото профиля: выбор файла вместо ввода ссылки. Бэкенд пережимает в WebP и отвечает
	// обновлённым профилем — показываем его сразу, своего предпросмотра не держим.
	// «Убрать» снимает и загруженный файл, и аватар от Google или GitHub.
	const user = $derived(session.user!);

	let input = $state<HTMLInputElement>();
	let busy = $state(false);
	let error = $state('');

	async function pick(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		// Поле сбрасываем сразу: иначе тот же файл второй раз не выберется (change не сработает).
		target.value = '';
		if (!file) return;
		error = avatarFileError(file) ?? '';
		if (error) return;
		busy = true;
		try {
			updateUser(await uploadAvatar(api, file));
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
			updateUser(await deleteAvatar(api));
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-4">
		<Avatar {user} size="w-20" />
		<div class="flex min-w-0 flex-col gap-2">
			<div class="font-semibold">{user.display_name || user.username}</div>
			<div class="flex flex-wrap items-center gap-2">
				<input
					bind:this={input}
					type="file"
					class="hidden"
					accept={AVATAR_ACCEPT}
					onchange={pick}
				/>
				<button type="button" class="btn btn-sm" disabled={busy} onclick={() => input?.click()}>
					{user.avatar_url ? 'Заменить фото' : 'Загрузить фото'}
				</button>
				{#if user.avatar_url}
					<button type="button" class="btn btn-ghost btn-sm" disabled={busy} onclick={remove}>
						Убрать
					</button>
				{/if}
				<a class="link text-sm link-hover" href="/u/{user.username}">Открыть профиль</a>
			</div>
		</div>
	</div>
	<p class="text-sm text-base-content/60">
		JPEG, PNG, WebP или GIF до 2 МБ. Картинка уменьшается до 512 px по длинной стороне; в круг она
		кадрируется по центру.
	</p>
	{#if error}<Alert>{error}</Alert>{/if}
</div>
