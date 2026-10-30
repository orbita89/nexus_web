<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { logout, session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { unreadLabel } from '#lib/chat/rooms.ts';
	import Avatar from './Avatar.svelte';
	import TitleSearch from './catalog/TitleSearch.svelte';

	// Фильмы, сериалы, книги и игры — один пункт «Каталог», иначе шапка не влезает
	// в узкий экран и при смене ширины всё съезжает.
	const catalog = KINDS.map((k) => ({ href: `/${k.slug}`, title: k.title }));
	const sections = [
		{ href: '/people', title: 'Люди' },
		{ href: '/awards', title: 'Награды' },
		{ href: '/collections', title: 'Коллекции' },
		{ href: '/feed', title: 'Лента' },
		{ href: '/forum', title: 'Форум' },
		{ href: '/about', title: 'О приложении' }
	];

	// На главной шапка лежит поверх арта «Кассандры» и остаётся прозрачной, пока страницу
	// не прокрутили: ниже она снова получает фон, иначе текст контента просвечивает сквозь неё.
	let scrolled = $state(false);
	const overArt = $derived(page.url.pathname === '/' && !scrolled);

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	const catalogActive = $derived(catalog.some((c) => isActive(c.href)));

	const next = $derived(
		page.url.pathname.startsWith('/auth/')
			? ''
			: `?next=${encodeURIComponent(page.url.pathname + page.url.search)}`
	);

	let menuOpen = $state(false);
	// «Каталог» на десктопе: сам по себе <details> остаётся открытым — закрываем
	// после перехода и по клику мимо.
	let catalogOpen = $state(false);
	let catalogEl: HTMLDetailsElement | undefined = $state();
	let menuEl: HTMLDetailsElement | undefined = $state();
	afterNavigate(() => {
		menuOpen = false;
		catalogOpen = false;
	});

	async function signOut() {
		await logout();
		await goto('/');
	}
</script>

<svelte:window
	onclick={(e) => {
		if (catalogOpen && !catalogEl?.contains(e.target as Node)) catalogOpen = false;
		if (menuOpen && !menuEl?.contains(e.target as Node)) menuOpen = false;
	}}
	onscroll={() => (scrolled = window.scrollY > 24)}
	onkeydown={(e) => e.key === 'Escape' && ((catalogOpen = false), (menuOpen = false))}
/>

<header
	class={[
		'sticky top-0 z-20 border-b transition-colors',
		overArt
			? 'border-transparent bg-transparent'
			: 'border-base-300 bg-base-100/85 backdrop-blur-md'
	]}
>
	<nav class="navbar w-full gap-2 px-4" aria-label="Основная навигация">
		<div class="navbar-start w-auto gap-1">
			<details class="dropdown md:hidden" bind:this={menuEl} bind:open={menuOpen}>
				<summary class="btn btn-square btn-ghost btn-sm" aria-label="Меню">☰</summary>
				<ul class="menu dropdown-content z-10 mt-2 w-48 rounded-box bg-base-200 shadow-sm">
					<li>
						<details open={catalogActive}>
							<summary class={{ 'menu-active': catalogActive }}>Каталог</summary>
							<ul>
								{#each catalog as c (c.href)}
									<li>
										<a href={c.href} class={{ 'menu-active': isActive(c.href) }}>{c.title}</a>
									</li>
								{/each}
							</ul>
						</details>
					</li>
					{#each sections as s (s.href)}
						<li><a href={s.href} class={{ 'menu-active': isActive(s.href) }}>{s.title}</a></li>
					{/each}
				</ul>
			</details>
			<a href="/" class="btn btn-ghost px-2 text-lg font-black tracking-[0.2em] uppercase btn-sm"
				>Кассандра</a
			>
		</div>

		<ul class="menu menu-horizontal hidden gap-1 menu-sm md:flex">
			<li>
				<details bind:this={catalogEl} bind:open={catalogOpen}>
					<summary class={{ 'menu-active': catalogActive }}>Каталог</summary>
					<ul class="z-10 w-40 rounded-box bg-base-200 shadow-sm">
						{#each catalog as c (c.href)}
							<li><a href={c.href} class={{ 'menu-active': isActive(c.href) }}>{c.title}</a></li>
						{/each}
					</ul>
				</details>
			</li>
			{#each sections as s (s.href)}
				<li><a href={s.href} class={{ 'menu-active': isActive(s.href) }}>{s.title}</a></li>
			{/each}
		</ul>

		<div class="ml-auto navbar-end w-auto flex-1 gap-2">
			<form action="/search" method="GET" role="search" class="w-full max-w-56">
				<TitleSearch
					value={page.url.pathname === '/search' ? (page.url.searchParams.get('q') ?? '') : ''}
					placeholder="Поиск"
					label="Поиск по каталогу"
					class="input w-full input-sm"
					listClass="right-0 w-80"
				/>
			</form>

			<!-- Кнопка чата есть на любой ширине (иначе при смене ширины шапка дёргается):
			     на десктопе сворачивает правую панель, уже — открывает лист. -->
			<button
				class="btn indicator btn-circle btn-ghost btn-sm"
				aria-label="Чат"
				onclick={() => chat.toggle()}
			>
				{#if chat.unread}<span class="indicator-item badge badge-xs badge-primary"
						>{unreadLabel(chat.unread)}</span
					>{/if}
				<svg
					class="size-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg
				>
			</button>

			{#if session.status === 'authed' && session.user}
				<div class="dropdown dropdown-end">
					<div
						tabindex="0"
						role="button"
						class="btn btn-circle btn-ghost btn-sm"
						aria-label="Меню пользователя"
					>
						<Avatar user={session.user} />
					</div>
					<ul
						tabindex="-1"
						class="menu dropdown-content z-10 mt-2 w-52 rounded-box bg-base-200 shadow-sm"
					>
						<li class="truncate menu-title">
							{session.user.display_name || session.user.username}
						</li>
						<li><a href="/u/{session.user.username}">Профиль</a></li>
						<li><a href="/settings">Настройки</a></li>
						{#if session.user.role === 'admin'}<li><a href="/admin">Админка</a></li>{/if}
						<li><button type="button" onclick={signOut}>Выйти</button></li>
					</ul>
				</div>
			{:else if session.status === 'guest'}
				<a href="/auth/login{next}" class="btn btn-ghost btn-sm">Войти</a>
				<a href="/auth/register" class="btn hidden btn-primary btn-sm sm:inline-flex">Регистрация</a
				>
			{:else}
				<div class="h-8 w-24" aria-hidden="true"></div>
			{/if}
		</div>
	</nav>
</header>
