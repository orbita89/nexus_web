<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { count } from '#lib/catalog/labels.ts';
	import { feedKey, filterUrl, withQuery } from '#lib/catalog/url.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import PeopleFeed from '#lib/components/catalog/PeopleFeed.svelte';
	import { roleHue } from '#lib/components/catalog/PersonCard.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import { _PEOPLE_ROLES } from './+page.ts';
	import type { PageProps } from './$types';

	// Люди: поиск по мере ввода (через 300 мс, без новой записи в истории — «брэ» сразу покажет
	// Брэда Питта), фильтр по основной роли. Без запроса — самые известные.
	let { data }: PageProps = $props();

	let text = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const loading = $derived(navigating.to?.url.pathname === page.url.pathname);

	// «Назад», «вперёд», ссылка — поле следует за адресом; свой goto поле не трогает.
	afterNavigate(({ type }) => {
		if (type !== 'goto') text = data.q ?? '';
	});

	const PRIMARY = 6;
	const primary = _PEOPLE_ROLES.slice(0, PRIMARY);
	const more = _PEOPLE_ROLES.slice(PRIMARY);
	const moreActive = $derived(more.find((r) => r.value === data.role));
	const items = $derived(data.list.data?.items ?? []);
	const hue = $derived(roleHue(data.role));

	function search(delay: number) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (text.trim() === (data.q ?? '')) return;
			goto(filterUrl(page.url, { q: text }), { replace: true, reset: false });
		}, delay);
	}
</script>

<Seo
	title={data.q ? `Люди: ${data.q}` : 'Популярные люди'}
	description="Актёры, режиссёры, сценаристы и композиторы в каталоге Кассандра."
/>

<div
	class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 opacity-60 transition-[background] duration-700"
	style="background: radial-gradient(60% 100% at 50% 0%, oklch(0.45 0.16 {hue} / 0.35), transparent 70%)"
	aria-hidden="true"
></div>

<header class="mb-6">
	<h1 class="text-3xl font-black tracking-tight sm:text-5xl">
		{data.q ? 'Люди' : 'Популярные люди'}
	</h1>
	<p class="mt-2 text-sm text-base-content/60">
		{#if data.list.data && data.q}
			Найдено {data.list.data.total > data.list.data.limit ? 'около ' : ''}{count(
				data.list.data.total,
				['человек', 'человека', 'человек']
			)}
		{:else}
			Актёры, режиссёры, авторы книг и создатели игр — в одном месте
		{/if}
	</p>
</header>

<form
	method="GET"
	action="/people"
	onsubmit={(e) => {
		e.preventDefault();
		search(0);
	}}
	role="search"
	class="relative mb-5 max-w-xl"
>
	{#if data.role}<input type="hidden" name="role" value={data.role} />{/if}
	<svg
		class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-base-content/40"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
	>
	<input
		type="search"
		name="q"
		bind:value={text}
		oninput={() => search(300)}
		placeholder="Найти человека — по-русски или латиницей"
		aria-label="Поиск по имени"
		class="input h-12 w-full rounded-full bg-base-200/80 pl-12 backdrop-blur focus:bg-base-200"
	/>
</form>

<nav class="mb-8" aria-label="Основная роль">
	<div class="flex flex-wrap items-center gap-2">
		{#each primary as r (r.title)}
			{@const active = r.value === data.role}
			<a
				href={withQuery('/people', { q: data.q, role: r.value })}
				data-sveltekit-noscroll
				class={[
					'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
					active
						? 'border-transparent bg-primary text-primary-content'
						: 'border-base-content/10 bg-base-200/60 text-base-content/70 hover:border-base-content/30 hover:text-base-content'
				]}
				aria-current={active ? 'page' : undefined}>{r.title}</a
			>
		{/each}
		<div class="dropdown">
			<div
				tabindex="0"
				role="button"
				class={[
					'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
					moreActive
						? 'border-transparent bg-primary text-primary-content'
						: 'border-base-content/10 bg-base-200/60 text-base-content/70 hover:border-base-content/30'
				]}
			>
				{moreActive ? moreActive.title : 'Ещё'} ▾
			</div>
			<ul
				class="dropdown-content menu z-20 mt-2 w-56 rounded-box border border-base-content/10 bg-base-200 p-2 shadow-xl"
			>
				{#each more as r (r.title)}
					<li>
						<a
							href={withQuery('/people', { q: data.q, role: r.value })}
							data-sveltekit-noscroll
							class={{ 'menu-active': r.value === data.role }}
							onclick={() => (document.activeElement as HTMLElement | null)?.blur()}>{r.title}</a
						>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</nav>

{#snippet skeleton(n: number)}
	{#each { length: n } as _, i (i)}
		<li class="aspect-3/4 animate-pulse rounded-box bg-base-200"></li>
	{/each}
{/snippet}

<div aria-busy={loading}>
	{#if data.list.error}
		<LoadError message={data.list.error} />
	{:else if loading}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{@render skeleton(12)}
		</ul>
	{:else if items.length}
		{#key feedKey(page.url)}
			<PeopleFeed first={data.list.data!} q={data.q} role={data.role} />
		{/key}
	{:else}
		<EmptyState title="Никого не нашлось">
			Проверьте написание имени или <a href="/people" class="link link-primary"
				>посмотрите популярных</a
			>.
		</EmptyState>
	{/if}
</div>
