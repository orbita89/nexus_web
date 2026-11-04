<script lang="ts">
	import { chat } from '#lib/chat/chat.svelte.ts';
	import type { RoomMeta } from '#lib/chat/rooms.ts';
	import { HERO_GLASS } from '#lib/components/card/buttons.ts';

	// «Открыть чат» — комната карточки, человека или тега в правой панели. Читать можно и без
	// интереса и без входа: панель сама подпишет канал комнаты.
	let {
		meta,
		class: className = HERO_GLASS,
		short = false
	}: {
		meta: RoomMeta;
		class?: string;
		/** В тесном ряду шапки подпись прячем до широкого экрана — остаётся иконка. */
		short?: boolean;
	} = $props();
</script>

<button
	class={className}
	aria-label="Открыть чат"
	title={short ? 'Открыть чат' : undefined}
	onclick={() => chat.open({ ...meta })}
>
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
		><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg
	>
	{#if !short}<span>Открыть чат</span>{/if}
</button>
