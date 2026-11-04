<script lang="ts">
	import type { Snippet } from 'svelte';
	import { HERO_ICON } from './buttons.ts';

	// «⋯» — редкие действия карточки: в коллекцию, следить, поделиться. В ряду они стоили по
	// кнопке каждое, а шапка и без них разъезжалась на три ряда; здесь они с подписями, что
	// понятнее иконок, и не отвлекают от «Оценить».
	let { children, label = 'Ещё' }: { children: Snippet; label?: string } = $props();

	let open = $state(false);
	let box = $state<HTMLDetailsElement>();
</script>

<svelte:window
	onclick={(e) => {
		if (open && box && !box.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (open && e.key === 'Escape') open = false;
	}}
/>

<details class="dropdown dropdown-end" bind:this={box} bind:open>
	<summary class={HERO_ICON} aria-label={label} title={label}>
		<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle
				cx="19"
				cy="12"
				r="1.8"
			/>
		</svg>
	</summary>
	<div
		class="dropdown-content z-30 mt-2 w-60 rounded-box border border-base-300 bg-base-200 p-2 shadow-xl"
	>
		{@render children()}
	</div>
</details>
