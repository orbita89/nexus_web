<script lang="ts">
	import type { RoomMeta } from '#lib/chat/rooms.ts';
	import { splitRoom } from '#lib/chat/rooms.ts';

	// Круглая картинка комнаты: обложка, фото или буква на цветном фоне (тег — «#»).
	let { meta, size = 'size-10' }: { meta: RoomMeta; size?: string } = $props();

	let failed = $state(false);
	const kind = $derived(splitRoom(meta.room).kind);
	const letter = $derived(kind === 'tag' ? '#' : meta.title.slice(0, 1).toUpperCase());
	// Цвет буквы — от названия: у каждой комнаты свой, как в списке друзей.
	const COLORS = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-info', 'bg-success', 'bg-warning'];
	const color = $derived(
		COLORS[[...meta.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]
	);
</script>

{#if meta.image && !failed}
	<img
		src={meta.image}
		alt=""
		class="{size} shrink-0 rounded-full object-cover ring-1 ring-base-content/10"
		loading="lazy"
		onerror={() => (failed = true)}
	/>
{:else}
	<span
		class="{size} {color} flex shrink-0 items-center justify-center rounded-full font-bold text-base-100"
		aria-hidden="true">{letter}</span
	>
{/if}
