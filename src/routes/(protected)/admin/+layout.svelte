<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import type { LayoutProps } from './$types';

	// Админка: только роль admin (бэкенд всё равно проверяет каждый запрос — 403).
	let { children }: LayoutProps = $props();

	const sections = [
		{ href: '/admin', title: 'Обзор' },
		{ href: '/admin/entities', title: 'Произведения' },
		{ href: '/admin/people', title: 'Люди' },
		{ href: '/admin/tags', title: 'Теги' },
		{ href: '/admin/users', title: 'Пользователи' }
	];
	const isActive = (href: string) =>
		href === '/admin' ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

{#if session.user?.role !== 'admin'}
	<h1 class="mb-4 text-2xl font-bold">Админка</h1>
	<Alert>Нет доступа: раздел только для администраторов.</Alert>
{:else}
	<div class="grid gap-6 lg:grid-cols-[12rem_1fr]">
		<nav aria-label="Разделы админки">
			<p class="mb-2 px-3 text-xs font-semibold tracking-widest text-primary uppercase">Админка</p>
			<ul class="menu w-full rounded-box bg-base-200 p-2 ring-1 ring-base-300">
				{#each sections as s (s.href)}
					<li>
						<a
							href={s.href}
							class={{ 'menu-active': isActive(s.href) }}
							aria-current={isActive(s.href) ? 'page' : undefined}>{s.title}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="min-w-0">{@render children()}</div>
	</div>
{/if}
