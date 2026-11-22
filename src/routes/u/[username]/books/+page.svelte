<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import {
		colorHex,
		listOwn,
		readHref,
		type AnnotationKind,
		type AnnotationWithEntity
	} from '#lib/reader/annotations.ts';

	// «Из книг»: свои закладки и выделения во всех книгах, новые сверху. Видны только владельцу
	// (как заметки) — у чужого профиля вкладки нет, а по прямой ссылке — пояснение.
	const PAGE = 30;
	const username = $derived(page.params.username);
	const mine = $derived(session.status === 'authed' && session.user?.username === username);

	let kind = $state<AnnotationKind | undefined>(undefined);
	let items = $state<AnnotationWithEntity[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		const filter = kind;
		if (!mine) {
			loading = session.status === 'loading';
			return;
		}
		let stale = false;
		loading = true;
		error = '';
		listOwn(api, { kind: filter, limit: PAGE })
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
			const p = await listOwn(api, { kind, limit: PAGE, offset: items.length });
			items = [...items, ...p.items];
			total = p.total;
		} catch (e) {
			error = errorMessage(e);
		}
	}

	const FILTERS: { value: AnnotationKind | undefined; title: string }[] = [
		{ value: undefined, title: 'Всё' },
		{ value: 'highlight', title: 'Выделения' },
		{ value: 'bookmark', title: 'Закладки' }
	];
</script>

<Seo title="Из книг" noindex />

{#if !mine && !loading}
	<EmptyState title="Пометки из книг видны только их автору"
		>Закладки, выделения и заметки в читалке — личные: их не видит никто, кроме вас.</EmptyState
	>
{:else}
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<div class="join" role="radiogroup" aria-label="Что показать">
			{#each FILTERS as f (f.title)}
				<button
					type="button"
					role="radio"
					aria-checked={kind === f.value}
					class={['btn join-item btn-sm', kind === f.value && 'btn-active']}
					onclick={() => (kind = f.value)}>{f.title}</button
				>
			{/each}
		</div>
		{#if !loading && !error}
			<p class="text-sm text-base-content/50">{total.toLocaleString('ru-RU')} — видно только вам</p>
		{/if}
	</div>

	{#if error}
		<LoadError message={error} />
	{:else if loading}
		<div class="h-40 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
	{:else if !items.length}
		<EmptyState title="Пока пусто"
			>Откройте книгу в читалке: значок закладки в шапке, а выделить текст — просто выделите его.</EmptyState
		>
	{:else}
		<ul class="flex flex-col gap-3" aria-label="Пометки из книг">
			{#each items as a (a.id)}
				<li
					class="rounded-box bg-base-200 p-4 ring-1 ring-base-300"
					style="border-left:4px solid {a.kind === 'highlight'
						? colorHex(a.color)
						: 'var(--color-primary)'}"
				>
					<div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
						<a href="/books/{a.entity.slug}" class="font-semibold hover:text-primary"
							>{a.entity.title}</a
						>
						<span class="text-xs text-base-content/40"><TimeAgo iso={a.updated_at} /></span>
					</div>
					<p class="mb-1 text-xs text-base-content/50">
						{a.kind === 'bookmark' ? 'Закладка' : 'Выделение'}{a.chapter
							? ` · ${a.chapter}`
							: ''}{a.fraction != null ? ` · ${Math.round(a.fraction * 100)}%` : ''}
					</p>
					{#if a.text}<blockquote class="text-sm">«{a.text}»</blockquote>{/if}
					{#if a.note}<p class="mt-1 text-sm text-base-content/70 italic">{a.note}</p>{/if}
					<a
						href={readHref(a.entity.slug, a.cfi)}
						class="mt-2 inline-block link text-sm link-primary">Открыть в читалке</a
					>
				</li>
			{/each}
		</ul>
		{#if items.length < total}
			<button type="button" class="btn mt-4 btn-block" onclick={more}>Показать ещё</button>
		{/if}
	{/if}
{/if}
