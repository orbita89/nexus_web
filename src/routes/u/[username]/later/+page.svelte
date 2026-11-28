<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityCard, { type CardEntity } from '#lib/components/catalog/EntityCard.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { listMyMarks, rememberLaterEmpty } from '#lib/social/marks.ts';

	// «Отложено»: всё, что отмечено «позже», новые сверху. Личное — только владельцу, как «Из книг».
	const PAGE = 24;
	const username = $derived(page.params.username);
	const mine = $derived(session.status === 'authed' && session.user?.username === username);

	let items = $state<CardEntity[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state('');

	// В social `EntityRef.kind` — строка: незнакомый раздел пропускаем.
	const cards = (page: Awaited<ReturnType<typeof listMyMarks>>): CardEntity[] =>
		page.items.flatMap((m) => {
			const kind = KINDS.find((k) => k.kind === m.entity.kind)?.kind;
			return kind ? [{ ...m.entity, kind }] : [];
		});

	$effect(() => {
		if (!mine) {
			loading = session.status === 'loading';
			return;
		}
		let stale = false;
		loading = true;
		error = '';
		listMyMarks(api, 'later', { limit: PAGE })
			.then((p) => {
				if (stale) return;
				items = cards(p);
				total = p.total;
				// Заодно уточняем флаг главной: пусто или нет.
				if (session.user) rememberLaterEmpty(session.user.username, p.total === 0);
			})
			.catch((e) => !stale && (error = errorMessage(e)))
			.finally(() => !stale && (loading = false));
		return () => {
			stale = true;
		};
	});

	async function more() {
		try {
			const p = await listMyMarks(api, 'later', { limit: PAGE, offset: items.length });
			items = [...items, ...cards(p)];
			total = p.total;
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<Seo title="Отложено" noindex />

{#if !mine && !loading}
	<EmptyState title="Отложенное видно только владельцу"
		>Список «позже» личный: его не видит никто, кроме самого человека.</EmptyState
	>
{:else if error}
	<LoadError message={error} />
{:else if loading}
	<div class="h-40 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
{:else if !items.length}
	<EmptyState title="Пока пусто"
		>Нажмите «Посмотреть позже» на карточке — и она появится здесь.</EmptyState
	>
{:else}
	<p class="mb-4 text-sm text-base-content/50">{total.toLocaleString('ru-RU')} — видно только вам</p>
	<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-label="Отложено">
		{#each items as entity (entity.slug)}
			<li><EntityCard {entity} showKind /></li>
		{/each}
	</ul>
	{#if items.length < total}
		<div class="mt-6 text-center">
			<button type="button" class="btn btn-outline" onclick={more}>Показать ещё</button>
		</div>
	{/if}
{/if}
