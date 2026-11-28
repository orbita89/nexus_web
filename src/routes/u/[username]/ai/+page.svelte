<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import { listMyThreads } from '#lib/tutor/api.ts';

	// «ИИ»: свои обсуждения книг с ИИ-преподавателем, свежие сверху — вернуться к разговору.
	// Видны только владельцу.
	const PAGE = 30;
	const username = $derived(page.params.username);
	const mine = $derived(session.status === 'authed' && session.user?.username === username);

	type Item = Awaited<ReturnType<typeof listMyThreads>>['items'][number];
	let items = $state<Item[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		if (!mine) {
			loading = session.status === 'loading';
			return;
		}
		let stale = false;
		listMyThreads(api, { limit: PAGE })
			.then((p) => {
				if (stale) return;
				items = p.items;
				total = p.total;
			})
			.catch((e) => !stale && (error = errorMessage(e)))
			.finally(() => !stale && (loading = false));
		return () => {
			stale = true;
		};
	});

	async function more() {
		try {
			const p = await listMyThreads(api, { limit: PAGE, offset: items.length });
			items = [...items, ...p.items];
			total = p.total;
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<Seo title="Обсуждения с ИИ" noindex />

{#if !mine && !loading}
	<EmptyState title="Обсуждения с ИИ видны только их автору"
		>Это личные разговоры с ИИ-преподавателем.</EmptyState
	>
{:else if error}
	<LoadError message={error} />
{:else if loading}
	<div class="h-40 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
{:else if !items.length}
	<EmptyState title="Пока нет обсуждений"
		>Откройте книгу и нажмите «Обсудить с ИИ» — или спросите о непонятном месте прямо в читалке.</EmptyState
	>
{:else}
	<p class="mb-4 text-sm text-base-content/50">
		{total.toLocaleString('ru-RU')} — видно только вам
	</p>
	<ul class="flex flex-col gap-3">
		{#each items as t (t.id)}
			<li>
				<a
					href="/ai/{t.id}"
					class="block rounded-box bg-base-200 p-4 ring-1 ring-base-300 transition-colors hover:ring-primary/50"
				>
					<div class="flex flex-wrap items-baseline justify-between gap-x-3">
						<span class="font-semibold">{t.title}</span>
						<span class="text-xs text-base-content/40"><TimeAgo iso={t.updated_at} /></span>
					</div>
					<p class="text-sm text-base-content/60">
						{t.entity ? `«${t.entity.title}»` : (t.person?.full_name ?? '')} · сообщений: {t.messages_count}
					</p>
				</a>
			</li>
		{/each}
	</ul>
	{#if items.length < total}
		<button type="button" class="btn mt-4 btn-block" onclick={more}>Показать ещё</button>
	{/if}
{/if}
