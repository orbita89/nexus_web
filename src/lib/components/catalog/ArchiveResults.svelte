<script lang="ts">
	import { originalTitle } from '#lib/admin/archive.ts';
	import { Promotions } from '#lib/admin/promote.svelte.ts';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
	import { guestApi, session } from '#lib/auth/session.svelte.ts';
	import { count, yearOf } from '#lib/catalog/labels.ts';
	import PromoteButton from '#lib/components/admin/PromoteButton.svelte';
	import PromoteToasts from '#lib/components/admin/PromoteToasts.svelte';
	import Poster from './Poster.svelte';

	// «Из архива»: фильмы, которых нет на сайте, — под основной выдачей раздела при «Искать в
	// архиве». Архив ищет только по названию. Приглушены и с бейджем «В архиве»; не ссылки —
	// карточек у них нет. «Показать ещё» догружает в браузере. Админу — «Вернуть на сайт».
	let {
		q,
		first,
		pageSize
	}: { q: string; first: { items: SchemaArchiveDoc[]; total: number }; pageSize: number } =
		$props();

	/** Бэкенд отдаёт offset только до 1000. */
	const MAX_OFFSET = 1000;

	let more = $state<SchemaArchiveDoc[]>([]);
	let gone = $state<string[]>([]);
	let loading = $state(false);
	let error = $state('');
	const docs = $derived([...first.items, ...more].filter((d) => !gone.includes(d.slug)));
	const loaded = $derived(first.items.length + more.length);
	const canMore = $derived(loaded < first.total && loaded <= MAX_OFFSET);
	const isAdmin = $derived(session.user?.role === 'admin');
	const promotions = new Promotions((slug) => (gone = [...gone, slug]));

	async function loadMore() {
		loading = true;
		error = '';
		try {
			const page = await unwrap(
				guestApi.catalog.GET('/api/v1/catalog/archive/search', {
					params: { query: { q, limit: pageSize, offset: loaded } }
				})
			);
			more = [...more, ...page.items];
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}
</script>

<section class="mt-12" aria-labelledby="archive-results">
	<h2 id="archive-results" class="flex items-baseline gap-2 text-xl font-bold">
		Из архива
		<span class="text-sm font-normal text-base-content/40"
			>{count(first.total, ['фильм', 'фильма', 'фильмов'])}</span
		>
	</h2>
	<p class="mb-4 text-sm text-base-content/60">
		Этих фильмов нет на сайте. В архиве ищем только по названию.
	</p>
	{#if docs.length}
		<ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{#each docs as doc (doc.slug)}
				{@const original = originalTitle(doc)}
				<li class="relative">
					<div class="opacity-60 grayscale-[40%]">
						<Poster title={doc.title} kind={doc.kind} coverUrl={doc.cover_url} />
					</div>
					<span class="absolute top-2 left-2 badge badge-sm shadow-md badge-neutral">В архиве</span>
					<div class="mt-2 px-0.5">
						<h3 class="line-clamp-2 text-sm leading-snug font-semibold text-base-content/70">
							{doc.title}
						</h3>
						<p class="mt-0.5 line-clamp-1 text-xs text-base-content/45">
							{[yearOf(doc.release_date), original].filter(Boolean).join(' · ')}
						</p>
						{#if isAdmin}<div class="mt-2"><PromoteButton {doc} {promotions} /></div>{/if}
					</div>
				</li>
			{/each}
		</ul>
		{#if error}<p class="mt-4 text-sm text-error">{error}</p>{/if}
		{#if canMore}
			<button class="btn mt-6 btn-outline btn-sm" disabled={loading} onclick={loadMore}>
				{#if loading}<span class="loading loading-xs loading-spinner"></span>{/if}
				Показать ещё
			</button>
		{/if}
	{:else}
		<p class="text-sm text-base-content/50">В архиве по запросу «{q}» ничего нет.</p>
	{/if}
</section>

<PromoteToasts {promotions} />
