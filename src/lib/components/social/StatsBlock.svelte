<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';

	// Общая обвязка вкладок аналитики: скелетон, «закрыто» и ошибка — в одном месте.
	// «Закрыто» (403 stats_private) — не ошибка: ни LoadError, ни «Повторить» здесь не нужны.
	let {
		query,
		username,
		children
	}: {
		query: {
			current: unknown;
			error: string;
			closed: boolean;
			loading: boolean;
			retry: () => void;
		};
		username: string;
		children: Snippet;
	} = $props();
</script>

{#if query.closed}
	<EmptyState title="Статистика закрыта">
		@{username} не открывал свою статистику другим.
	</EmptyState>
{:else if query.error}
	<LoadError message={query.error} onretry={() => query.retry()} />
{:else if query.current}
	{@render children()}
{:else if query.loading}
	<div class="h-64 skeleton" aria-label="Загрузка статистики"></div>
{/if}
