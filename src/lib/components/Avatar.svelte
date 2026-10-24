<script lang="ts">
	import { avatarSrc } from '#lib/auth/avatar.ts';

	let {
		user,
		size = 'w-8'
	}: {
		user: { username: string; display_name?: string | null; avatar_url?: string | null };
		size?: string;
	} = $props();

	const initial = $derived((user.display_name || user.username).slice(0, 1).toUpperCase());
	// Относительный адрес загруженного фото и абсолютный от провайдера — оба как есть (avatarSrc).
	const src = $derived(avatarSrc(user.avatar_url));
</script>

{#if src}
	<div class="avatar">
		<div class="{size} rounded-full">
			<!-- Бэкенд не вырезает квадрат (длинная сторона 512 px) — кадрируем сами. -->
			<img {src} alt="" class="size-full object-cover" referrerpolicy="no-referrer" />
		</div>
	</div>
{:else}
	<div class="avatar avatar-placeholder">
		<div class="{size} rounded-full bg-neutral text-neutral-content">
			<span>{initial}</span>
		</div>
	</div>
{/if}
