<script module lang="ts">
export interface ProfileTab {
	href: string;
	title: string;
	n: number | null;
	/** Вкладка только для владельца профиля. */
	ownerOnly?: boolean;
}
</script>

<script lang="ts">
	import { page } from '$app/state';

	let { username, tabs, isOwner }: { username: string; tabs: ProfileTab[]; isOwner: boolean } =
		$props();

	const visible = $derived(tabs.filter((t) => isOwner || !t.ownerOnly));
	const isActive = (href: string) => page.url.pathname === href;
</script>

<nav
	class="overflow-x-auto overflow-y-hidden border-t border-base-300 px-2 pb-px sm:px-4"
	aria-label="Разделы профиля"
	data-username={username}
>
	<ul class="flex gap-1">
		{#each visible as tab (tab.href)}
			<li>
				<a
					href={tab.href}
					data-sveltekit-noscroll
					class={[
						'-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors',
						isActive(tab.href)
							? 'border-orange-500 font-semibold text-base-content'
							: 'border-transparent text-base-content/60 hover:text-base-content'
					]}
					aria-current={isActive(tab.href) ? 'page' : undefined}
				>
					{tab.title}
					{#if tab.n !== null}
						<span class="text-xs text-base-content/40 tabular-nums">{tab.n}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
