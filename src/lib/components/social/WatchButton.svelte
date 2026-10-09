<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import type { Watch } from '#lib/social/watch.svelte.ts';
	import { HERO_ICON, HERO_ICON_ON } from '#lib/components/card/buttons.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// Колокольчик «Следить». Состояние — общее на карточку (Watch). Круглая иконка: в шапке — в
	// стиле её кнопок с тултипом, compact — маленькая для липкой мобильной шапки.
	let { watch, compact = false }: { watch: Watch; compact?: boolean } = $props();

	const hintId = $props.id();
	const hint = $derived(
		watch.watching
			? 'Вы следите — новости и релизы придут в ленту. Нажмите, чтобы отписаться'
			: 'Получать уведомления о новостях и релизах'
	);
</script>

{#snippet bell(on: boolean)}
	<svg
		class="size-4.5"
		viewBox="0 0 24 24"
		fill={on ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path
			d="M10.3 21a1.94 1.94 0 0 0 3.4 0"
		/></svg
	>
{/snippet}

{#if compact}
	{#if session.status === 'guest'}
		<a href={loginUrl(page.url)} class="btn btn-circle btn-ghost btn-sm" aria-label="Следить"
			>{@render bell(false)}</a
		>
	{:else if session.status === 'authed' && watch.watching !== null}
		<button
			class={['btn btn-circle btn-ghost btn-sm', { 'text-primary': watch.watching }]}
			aria-label={watch.watching ? 'Вы следите' : 'Следить'}
			aria-pressed={watch.watching}
			disabled={watch.busy}
			onclick={() => watch.toggle()}>{@render bell(watch.watching)}</button
		>
	{/if}
{:else}
	<!-- Круглая иконка в стиле кнопок шапки; подпись — в тултипе. Тултип DaisyUI — только для глаз,
	     скринридеру та же подсказка через aria-describedby, название — aria-label. -->
	<div class="tooltip tooltip-bottom" data-tip={hint}>
		<span id={hintId} class="sr-only">{hint}</span>
		{#if session.status === 'guest'}
			<a href={loginUrl(page.url)} class={HERO_ICON} aria-label="Следить" aria-describedby={hintId}
				>{@render bell(false)}</a
			>
		{:else if session.status === 'authed' && watch.watching !== null}
			<button
				class={[watch.watching ? HERO_ICON_ON : HERO_ICON, 'transition active:scale-90']}
				aria-label={watch.watching ? 'Вы следите' : 'Следить'}
				aria-pressed={watch.watching}
				aria-describedby={hintId}
				disabled={watch.busy}
				onclick={() => watch.toggle()}>{@render bell(watch.watching)}</button
			>
		{:else}
			<!-- Пока сессия и состояние грузятся — место под кнопку, без прыжка. -->
			<span class="size-10 skeleton rounded-full" aria-hidden="true"></span>
		{/if}
	</div>
	{#if watch.error}<span role="alert" class="self-center text-sm text-error">{watch.error}</span
		>{/if}
{/if}
