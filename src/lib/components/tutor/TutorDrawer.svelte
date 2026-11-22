<script lang="ts">
	import TutorChat from './TutorChat.svelte';

	// Панель ИИ-преподавателя справа поверх страницы (на телефоне — на весь экран). Закрывается
	// крестиком, щелчком мимо и Esc. Чат внутри создаётся заново при каждом открытии.
	let {
		open = $bindable(false),
		slug,
		title,
		quote = $bindable(null),
		chapter = null,
		fraction = null
	}: {
		open?: boolean;
		slug: string;
		title: string;
		quote?: string | null;
		chapter?: string | null;
		fraction?: number | null;
	} = $props();
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if open}
	<div
		class="fixed inset-0 z-[80] flex justify-end"
		role="dialog"
		aria-modal="true"
		aria-label="ИИ-преподаватель"
	>
		<button
			type="button"
			class="absolute inset-0 bg-black/40"
			aria-label="Закрыть"
			onclick={() => (open = false)}
		></button>
		<div
			class="relative flex h-full w-full max-w-lg flex-col bg-base-100 text-base-content shadow-2xl"
		>
			<header class="flex items-center gap-2 border-b border-base-300 px-3 py-2">
				<div class="min-w-0 flex-1">
					<p class="text-sm font-semibold">ИИ-преподаватель</p>
					<p class="truncate text-xs text-base-content/50">«{title}»</p>
				</div>
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-sm"
					aria-label="Закрыть"
					onclick={() => (open = false)}>✕</button
				>
			</header>
			<div class="min-h-0 flex-1">
				<TutorChat {slug} {quote} {chapter} {fraction} onquoteclear={() => (quote = null)} />
			</div>
		</div>
	</div>
{/if}
