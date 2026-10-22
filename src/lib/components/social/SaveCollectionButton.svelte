<script lang="ts">
	// «Добавить в избранное» — закладка у названия подборки. Нажатие меняет состояние сразу,
	// ошибка — откат. Гостю — ссылка на вход. Показывается только при SAVES_SUPPORTED.
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { setCollectionSaved } from '#lib/social/collections.ts';

	let { id, saved = false }: { id: string; saved?: boolean } = $props();

	// Пропс задаёт начальное значение; нажатие перезаписывает до следующего пропса.
	let on = $derived(saved);
	let busy = $state(false);
	let error = $state('');

	const label = $derived(on ? 'В избранном' : 'Добавить в избранное');
	const loginHref = $derived(`/auth/login?next=${encodeURIComponent(page.url.pathname)}`);

	async function toggle() {
		if (busy) return;
		const before = on;
		on = !before;
		busy = true;
		error = '';
		try {
			await setCollectionSaved(api, id, on);
		} catch (e) {
			on = before;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

{#snippet icon(filled: boolean)}
	<svg
		viewBox="0 0 24 24"
		class="size-4"
		fill={filled ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linejoin="round"
		aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg
	>
{/snippet}

{#if session.status === 'authed'}
	<button
		type="button"
		class="btn btn-square btn-ghost btn-xs {on ? 'text-(--page-accent)' : ''}"
		aria-label={label}
		aria-pressed={on}
		title={error || label}
		disabled={busy}
		onclick={toggle}
	>
		{@render icon(on)}
	</button>
{:else}
	<a
		href={loginHref}
		class="btn btn-square btn-ghost btn-xs"
		aria-label="Добавить в избранное"
		title="Добавить в избранное">{@render icon(false)}</a
	>
{/if}
