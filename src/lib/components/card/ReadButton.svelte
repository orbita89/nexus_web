<script lang="ts">
	import { session } from '#lib/auth/session.svelte.ts';
	import { readAccess } from '#lib/reader/access.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import { HERO_GLASS } from './buttons.ts';

	// «Читать» на карточке книги. Страница статическая и одна для всех: в HTML — только «есть файл»
	// и «публичная»; что показать этому читателю (открыть, войти, по приглашению), решается в
	// браузере после гидрации. Защита — на сервере: читалка всё равно получит 401/403 и покажет его.
	let { slug, publicRead }: { slug: string; publicRead: boolean } = $props();

	const href = $derived(`/books/${slug}/read`);
	const access = $derived(readAccess(publicRead, session.status, session.user?.role));
</script>

{#snippet book()}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" /><path
			d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"
		/></svg
	>
{/snippet}

{#if access === 'login'}
	<a
		href={loginUrl({ pathname: href, search: '' })}
		class={HERO_GLASS}
		title="Войдите, чтобы читать"
	>
		{@render book()} Читать
	</a>
{:else if access === 'invite'}
	<button type="button" class={HERO_GLASS} disabled title="Доступ по приглашению">
		{@render book()} Доступ по приглашению
	</button>
{:else}
	<!-- read и wait: ссылка рабочая сразу — сервер сам проверит доступ. -->
	<a {href} class={HERO_GLASS} data-sveltekit-preload-data="off">{@render book()} Читать</a>
{/if}
