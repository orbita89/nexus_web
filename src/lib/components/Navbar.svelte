<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { logout, session } from '#lib/auth/session.svelte.ts';
	import Avatar from './Avatar.svelte';

	const sections = [
		...KINDS.map((k) => ({ href: `/${k.slug}`, title: k.title })),
		{ href: '/people', title: 'Люди' },
		{ href: '/feed', title: 'Лента' },
		{ href: '/forum', title: 'Форум' }
	];

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);

	const next = $derived(
		page.url.pathname.startsWith('/auth/')
			? ''
			: `?next=${encodeURIComponent(page.url.pathname + page.url.search)}`
	);

	let menuOpen = $state(false);
	afterNavigate(() => {
		menuOpen = false;
	});

	async function signOut() {
		await logout();
		await goto('/');
	}
</script>

<header class="sticky top-0 z-20 border-b border-base-300 bg-base-100/85 backdrop-blur-md">
	<nav class="navbar mx-auto max-w-6xl gap-2 px-4" aria-label="Основная навигация">
		<div class="navbar-start w-auto gap-1">
			<details class="dropdown lg:hidden" bind:open={menuOpen}>
				<summary class="btn btn-square btn-ghost btn-sm" aria-label="Меню">☰</summary>
				<ul class="menu dropdown-content z-10 mt-2 w-48 rounded-box bg-base-200 shadow-sm">
					{#each sections as s (s.href)}
						<li><a href={s.href} class={{ 'menu-active': isActive(s.href) }}>{s.title}</a></li>
					{/each}
				</ul>
			</details>
			<a href="/" class="btn btn-ghost px-2 text-lg font-black tracking-[0.2em] uppercase btn-sm"
				>Nexus<span class="-ml-1 text-primary" aria-hidden="true">.</span></a
			>
		</div>

		<ul class="menu menu-horizontal hidden gap-1 menu-sm lg:flex">
			{#each sections as s (s.href)}
				<li><a href={s.href} class={{ 'menu-active': isActive(s.href) }}>{s.title}</a></li>
			{/each}
		</ul>

		<div class="ml-auto navbar-end w-auto flex-1 gap-2">
			<form action="/search" method="GET" role="search" class="w-full max-w-56">
				<input
					type="search"
					name="q"
					value={page.url.pathname === '/search' ? (page.url.searchParams.get('q') ?? '') : ''}
					placeholder="Поиск"
					aria-label="Поиск по каталогу"
					class="input w-full input-sm"
				/>
			</form>

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
