<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { count } from '#lib/catalog/labels.ts';
	import { feedKey, filterUrl, withQuery } from '#lib/catalog/url.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import PeopleFeed from '#lib/components/catalog/PeopleFeed.svelte';
	import { roleHue } from '#lib/components/catalog/PersonCard.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import { onMount } from 'svelte';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { settle } from '#lib/catalog/load.ts';
	import { PEOPLE_ROLES, peopleList } from '#lib/catalog/people.ts';
	import { readText } from '#lib/catalog/url.ts';
	import { liveQuery } from '#lib/social/card-live.svelte.ts';
	import type { PageProps } from './$types';

	// Люди: поиск по мере ввода (через 300 мс, без новой записи в истории — «брэ» сразу покажет
	// Брэда Питта), фильтр по основной роли. Без запроса — самые известные.
	let { data }: PageProps = $props();

	// Страница статическая (+page.server.ts): в data — «Популярные люди». Поиск и роль из адреса
	// читаем только в браузере (nginx отдаёт файл без учёта query) и грузим из Tantivy сами.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const q = $derived(mounted ? readText(page.url, 'q') : undefined);
	const role = $derived(
		mounted
			? PEOPLE_ROLES.find((r) => r.value && r.value === readText(page.url, 'role'))?.value
			: undefined
	);
	const isDefault = $derived(!q && !role);
	const asked = liveQuery(
		() => ({ q, role }),
		async (key) => ({
			...key,
			list: key.q || key.role ? await settle(peopleList(guestApi, key.q, key.role)) : null
		})
	);
	const answer = $derived(
		asked.current?.data && asked.current.data.q === q && asked.current.data.role === role
			? asked.current.data.list
			: null
	);
	const list = $derived(isDefault ? { data: data.list, error: null } : answer);

	let text = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const loading = $derived(!isDefault && !answer);

	// «Назад», «вперёд», ссылка — поле следует за адресом; свой goto поле не трогает.
	afterNavigate(({ type }) => {
		if (type !== 'goto') text = page.url.searchParams.get('q') ?? '';
	});

	// Всегда на виду: Все, актёры, режиссёры, художники, авторы книг; остальное — в «Ещё».
	const PRIMARY = [undefined, 'actor', 'director', 'artist', 'author'];
	const facets = $derived(list?.data?.facets?.known_for);
	// Роли без людей прячем (кроме «Все» и выбранной): вкладка не должна вести на пустой экран.
	const roles = $derived(
		PEOPLE_ROLES.filter((r) => !facets || !r.value || facets[r.value] || r.value === role)
	);
	const primary = $derived(PRIMARY.flatMap((v) => roles.filter((r) => r.value === v)));
	const more = $derived(roles.filter((r) => !PRIMARY.includes(r.value)));
	const moreActive = $derived(more.find((r) => r.value === role));
	/** Число людей у чипа: у «Все» — сумма по ролям. */
	function roleCount(value?: string): number | undefined {
		if (!facets) return undefined;
		return value ? facets[value] : Object.values(facets).reduce((a, b) => a + b, 0);
	}
	const compact = new Intl.NumberFormat('ru', { notation: 'compact' });
	const items = $derived(list?.data?.items ?? []);
	const hue = $derived(roleHue(role));

	function search(delay: number) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (text.trim() === (q ?? '')) return;
			goto(filterUrl(page.url, { q: text }), { replace: true, reset: false });
		}, delay);
	}
</script>

<Seo
	title={q ? `Люди: ${q}` : 'Популярные люди'}
	description="Актёры, режиссёры, сценаристы и композиторы в каталоге Кассандра."
/>

<div
	class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 opacity-60 transition-[background] duration-700"
	style="background: radial-gradient(60% 100% at 50% 0%, oklch(0.45 0.16 {hue} / 0.35), transparent 70%)"
	aria-hidden="true"
></div>

<header class="mb-6">
	<h1 class="text-3xl font-black tracking-tight sm:text-5xl">
		{q ? 'Люди' : 'Популярные люди'}
	</h1>
	<p class="mt-2 text-sm text-base-content/60">
		{#if list?.data && q}
			Найдено {list?.data.total > list?.data.limit ? 'около ' : ''}{count(list?.data.total, [
				'человек',
				'человека',
				'человек'
			])}
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
	{#if role}<input type="hidden" name="role" value={role} />{/if}
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
			{@const active = r.value === role}
			<a
				href={withQuery('/people', { q: q, role: r.value })}
				data-sveltekit-noscroll
				class={[
					'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
					active
						? 'border-transparent bg-primary text-primary-content'
						: 'border-base-content/10 bg-base-200/60 text-base-content/70 hover:border-base-content/30 hover:text-base-content'
				]}
				aria-current={active ? 'page' : undefined}
				>{r.title}{#if roleCount(r.value)}<span class="ml-1.5 text-xs opacity-60"
						>{compact.format(roleCount(r.value) ?? 0)}</span
					>{/if}</a
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
				class="menu dropdown-content z-20 mt-2 w-56 rounded-box border border-base-content/10 bg-base-200 p-2 shadow-xl"
			>
				{#each more as r (r.title)}
					<li>
						<a
							href={withQuery('/people', { q: q, role: r.value })}
							data-sveltekit-noscroll
							class={{ 'menu-active': r.value === role }}
							onclick={() => (document.activeElement as HTMLElement | null)?.blur()}
							>{r.title}{#if roleCount(r.value)}<span class="ml-auto text-xs opacity-60"
									>{compact.format(roleCount(r.value) ?? 0)}</span
								>{/if}</a
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
	{#if list?.error}
		<LoadError message={list?.error} />
	{:else if loading}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{@render skeleton(12)}
		</ul>
	{:else if items.length}
		{#key feedKey(page.url)}
			<PeopleFeed first={list!.data!} {q} {role} />
		{/key}
	{:else}
		<EmptyState title="Никого не нашлось">
			Проверьте написание имени или <a href="/people" class="link link-primary"
				>посмотрите популярных</a
			>.
		</EmptyState>
	{/if}
</div>
