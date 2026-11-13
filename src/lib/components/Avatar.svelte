<script lang="ts">
	import { avatarSrc } from '#lib/auth/avatar.ts';

	let {
		user,
		size = 'w-8',
		shape = 'circle'
	}: {
		user: { username: string; display_name?: string | null; avatar_url?: string | null };
		size?: string;
		/** Форма: круг (по умолчанию), скруглённый квадрат или «впритык» к краям (шапка профиля). */
		shape?: 'circle' | 'square' | 'flush';
	} = $props();

	const initial = $derived((user.display_name || user.username).slice(0, 1).toUpperCase());
	// Относительный адрес загруженного фото и абсолютный от провайдера — оба как есть (avatarSrc).
	const src = $derived(avatarSrc(user.avatar_url));
	const radius = $derived(
		shape === 'square' ? 'rounded-2xl' : shape === 'flush' ? 'rounded-none' : 'rounded-full'
	);
	// «Впритык» занимает всю отведённую коробку — ей нужна высота от родителя.
	const wrap = $derived(shape === 'flush' ? 'block size-full' : '');
</script>

{#if src}
	<div class="avatar {wrap}">
		<div class="{size} {radius}">
			<!-- Бэкенд не вырезает квадрат (длинная сторона 512 px) — кадрируем сами. -->
			<img {src} alt="" class="size-full object-cover" referrerpolicy="no-referrer" />
		</div>
	</div>
{:else}
	<div class="avatar avatar-placeholder {wrap}">
		<div class="{size} {radius} bg-neutral text-neutral-content">
			<span>{initial}</span>
		</div>
	</div>
{/if}
