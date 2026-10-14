<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { originalTitle, tmdbHref } from '#lib/admin/archive.ts';
	import { Promotions } from '#lib/admin/promote.svelte.ts';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { guestApi, session } from '#lib/auth/session.svelte.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import Alert from '#lib/components/Alert.svelte';
	import EntityPage from '#lib/components/card/EntityPage.svelte';
	import PromoteButton from '#lib/components/admin/PromoteButton.svelte';
	import PromoteToasts from '#lib/components/admin/PromoteToasts.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	// Страница архивного фильма: сразу — что есть (постер, название, год, бейдж «Архив»), и тут же
	// в браузере POST …/restore: открыли фильм — ему место на сайте. 201/200 — бэкенд вернул его со
	// всеми данными TMDB и отдал полную карточку: показываем её (EntityPage) и меняем адрес на
	// адрес фильма без перезагрузки. 409, 429, 503 и прочее — остаёмся на архивной странице молча.
	// Архивная страница закрыта от индексации: их больше миллиона, и они почти пустые. Боты без JS
	// фильм не возвращают — запрос только в браузере.
	let { data }: PageProps = $props();

	const doc = $derived(data.doc);
	const year = $derived(yearOf(doc.release_date));
	const original = $derived(originalTitle(doc));
	const isAdmin = $derived(session.user?.role === 'admin');
	let returned = $state(false);
	let restored = $state<SchemaEntityDetail | null>(null);
	let restoring = $state(false);

	$effect(() => {
		const slug = doc.slug;
		let gone = false;
		restored = null;
		restoring = true;
		unwrap(
			guestApi.catalog.POST('/api/v1/catalog/archive/entities/{slug}/restore', {
				params: { path: { slug } }
			})
		)
			.then((entity) => {
				// Пока ждали, ушли на другую страницу — её адрес не трогаем.
				if (gone) return;
				restored = entity;
				replaceState(entityHref(entity), {});
			})
			.catch(() => {
				// Не вернулся (оставлен в архиве, лимит, TMDB недоступен) — архивная страница как есть.
			})
			.finally(() => {
				if (!gone) restoring = false;
			});
		return () => {
			gone = true;
		};
	});
	const promotions = new Promotions(() => (returned = true));
</script>

<svelte:head
	>{#if !restored}<meta name="robots" content="noindex" />{/if}</svelte:head
>

{#if restored}
	<EntityPage entity={restored} />
{:else}
	<Seo title="{doc.title}{year ? ` (${year})` : ''}" image={doc.cover_url} />

	<section
		aria-label="Архивный фильм: {doc.title}"
		class="mb-12 grid items-start gap-6 sm:grid-cols-[12rem_1fr] md:grid-cols-[16rem_1fr] md:gap-10"
	>
		<div class="w-40 opacity-80 sm:w-auto">
			<Poster
				title={doc.title}
				kind={doc.kind}
				coverUrl={doc.cover_url}
				alt="Постер: {doc.title}"
				eager
			/>
		</div>
		<div class="max-w-2xl min-w-0 md:pt-4">
			<div class="flex flex-wrap items-center gap-3">
				<span class="badge badge-neutral">Архив</span>
				{#if restoring}
					<span class="flex items-center gap-2 text-sm text-base-content/60" role="status">
						<span class="loading loading-xs loading-spinner"></span>Загружаем полную информацию…
					</span>
				{/if}
			</div>
			<h1 class="mt-3 text-2xl leading-tight font-black tracking-tight text-balance sm:text-4xl">
				{doc.title}
			</h1>
			{#if original || year}
				<p class="mt-2 text-base-content/60">{[original, year].filter(Boolean).join(' · ')}</p>
			{/if}
			<p class="mt-6 text-sm text-base-content/60">
				Этого фильма нет на сайте: он в архиве, поэтому у него нет описания, оценок и рецензий.
			</p>
			{#if doc.tmdb_id}
				<p class="mt-2 text-sm">
					<a
						href={tmdbHref(doc.tmdb_id)}
						target="_blank"
						rel="noopener noreferrer"
						class="link link-primary">Страница на TMDB</a
					>
				</p>
			{/if}
			{#if returned}
				<div class="mt-6">
					<Alert kind="success">
						Фильм возвращён на сайт — <a href={entityHref(doc)} class="link">открыть карточку</a>.
					</Alert>
				</div>
			{:else if isAdmin}
				<div class="mt-6"><PromoteButton {doc} {promotions} /></div>
			{/if}
		</div>
	</section>
{/if}

<PromoteToasts {promotions} />
