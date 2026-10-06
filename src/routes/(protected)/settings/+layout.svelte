<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const items = [
		{ href: '/settings', title: 'Профиль' },
		{ href: '/settings/email', title: 'Email' },
		{ href: '/settings/security', title: 'Пароль и сессии' },
		{ href: '/settings/accounts', title: 'Привязанные аккаунты' }
	];
</script>

<h1 class="mb-6 text-2xl font-bold">Настройки</h1>
<div class="grid gap-6 md:grid-cols-[14rem_1fr]">
	<ul class="menu h-fit w-full rounded-box bg-base-200">
		{#each items as item (item.href)}
			<li>
				<a href={item.href} class={{ 'menu-active': page.url.pathname === item.href }}
					>{item.title}</a
				>
			</li>
		{/each}
	</ul>
	<div class="max-w-xl">{@render children()}</div>
</div>
