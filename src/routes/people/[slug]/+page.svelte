<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { formatDate, summary, WORKS_SHOWN } from '#lib/catalog/labels.ts';
	import { ratingsFor } from '#lib/catalog/load.ts';
	import Awards from '#lib/components/card/Awards.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import PersonGallery from '#lib/components/catalog/PersonGallery.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import MyNote from '#lib/components/card/MyNote.svelte';
	import ChatButton from '#lib/components/chat/ChatButton.svelte';
	import PersonLikeButton from '#lib/components/social/PersonLikeButton.svelte';
	import TargetComments from '#lib/components/social/TargetComments.svelte';
	import WatchButton from '#lib/components/social/WatchButton.svelte';
	import { liveQuery } from '#lib/social/card-live.svelte.ts';
	import { Watch } from '#lib/social/watch.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Фильмография по ролям (data.roles): главная роль человека — первой, внутри — новые сверху.
	// Длинный список — первые WORKS_SHOWN, остальное — «Показать всех» без запросов.
	const person = $derived(data.person);
	// Абзацы биографии «🏆Главные награды🏆: …» и «🎬Главные проекты🎬: …» дублируют данные страницы:
	// награды — блок «Награды», проекты — вкладка «Главные проекты» (если нашли эти работы у человека).
	const paras = $derived((person.bio ?? '').split(/\n\s*\n/));
	const isHead = (p: string, head: string) =>
		new RegExp(`^\\s*\\p{Extended_Pictographic}*\\s*${head}`, 'u').test(p);
	const topPara = $derived(paras.find((p) => isHead(p, 'Главные проекты')));
	const topWorks = $derived.by(() => {
		if (!topPara) return [];
		const all = new Map(person.credits.map((c) => [c.entity.id, c.entity]));
		const found: (typeof person.credits)[number]['entity'][] = [];
		for (const m of topPara.matchAll(/«([^»]+)»(?:\s*\((\d{4})\))?/g)) {
			const title = m[1].trim().toLowerCase();
			const hit = [...all.values()].find(
				(e) =>
					e.title.toLowerCase() === title &&
					(!m[2] || !e.release_date || e.release_date.startsWith(m[2]))
			);
			if (hit && !found.includes(hit)) found.push(hit);
		}
		return found;
	});
	const bio = $derived(
		paras
			.filter((p) => !isHead(p, 'Главные награды') && !(topWorks.length && p === topPara))
			.join('\n\n')
			.trim()
	);
	// Оценки — в браузере (страница статическая): одним запросом с лимитом, сначала видимое.
	const ratingsQuery = liveQuery(
		() => data.roles,
		(roles) =>
			ratingsFor(
				guestApi,
				[
					...roles.flatMap((r) => r.works.slice(0, WORKS_SHOWN)),
					...roles.flatMap((r) => r.works.slice(WORKS_SHOWN))
				].map((w) => w.entity)
			)
	);
	const ratings = $derived(ratingsQuery.current?.data ?? {});
	const open = new SvelteSet<string>();
	// Роли — вкладки на одном уровне; открыта главная (первая), если выбранной у этого человека нет.
	let picked = $state<string>();
	const TOP = 'top';
	const tabs = $derived([
		...(topWorks.length ? [{ key: TOP, title: 'Главные проекты', n: topWorks.length }] : []),
		...data.roles.map((r) => ({ key: r.role, title: r.title, n: r.works.length }))
	]);
	const tab = $derived(tabs.find((t) => t.key === picked)?.key ?? tabs[0]?.key);
	const active = $derived(data.roles.find((r) => r.role === tab));
	const watch = new Watch(
		() => person.slug,
		() => person.id,
		'people'
	);
</script>

<Seo
	title={person.full_name}
	description={summary(bio) || `${person.full_name}: фильмы, сериалы, книги и игры в Кассандра.`}
	image={person.photo_url}
/>

<header
	class="mb-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left"
>
	<PersonGallery name={person.full_name} photoUrl={person.photo_url} photos={person.photos} />
	<div class="min-w-0">
		<p class="text-xs font-semibold tracking-widest text-primary uppercase">Человек</p>
		<h1 class="mt-1 text-3xl font-black sm:text-5xl">{person.full_name}</h1>
		{#if person.original_name && person.original_name !== person.full_name}
			<p class="mt-1 text-lg text-base-content/50">{person.original_name}</p>
		{/if}
		{#if person.birth_date}
			<p class="mt-2 text-sm text-base-content/50">
				Дата рождения: {formatDate(person.birth_date)}
			</p>
		{/if}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
			<PersonLikeButton slug={person.slug} likesCount={person.likes_count} liked={person.liked} />
			<WatchButton {watch} />
			<ChatButton
				meta={{
					room: `person:${person.slug}`,
					title: person.full_name,
					href: `/people/${person.slug}`,
					image: person.photo_url ?? null
				}}
			/>
		</div>
		{#if bio}
			<p class="mt-4 max-w-2xl leading-relaxed whitespace-pre-line text-base-content/80">
				{bio}
			</p>
		{/if}
	</div>
</header>

{#if person.awards.length}
	<!-- Награды человека: с работой, за которую он номинирован. -->
	<Awards awards={person.awards} withEntity />
{/if}

<MyNote slug={person.slug} target="people" />

<section aria-label="Фильмография">
	{#if tabs.length > 1}
		<div class="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Деятельность">
			{#each tabs as r (r.key)}
				{@const current = r.key === tab}
				<button
					type="button"
					role="tab"
					id="tab-{r.key}"
					aria-selected={current}
					aria-controls="panel-{r.key}"
					tabindex={current ? 0 : -1}
					class={[
						'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
						current
							? 'border-transparent bg-primary text-primary-content'
							: 'border-base-content/10 bg-base-200/60 text-base-content/70 hover:border-base-content/30 hover:text-base-content'
					]}
					onclick={() => (picked = r.key)}
					onkeydown={(e) => {
						const i = tabs.findIndex((x) => x.key === r.key);
						const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
						if (!step) return;
						e.preventDefault();
						const next = tabs[(i + step + tabs.length) % tabs.length];
						picked = next.key;
						document.getElementById(`tab-${next.key}`)?.focus();
					}}
				>
					{r.title}
					<span class="ml-1 text-xs opacity-60">{r.n}</span>
				</button>
			{/each}
		</div>
	{/if}
	{#if tab === TOP}
		<div id="panel-top" role="tabpanel" aria-labelledby="tab-top">
			<EntityGrid entities={topWorks} {ratings} />
		</div>
	{:else if active}
		{@const role = active}
		{@const all = open.has(role.role)}
		{@const captions = new Map(role.works.map((w) => [w.entity.id, w.caption]))}
		<section
			id="panel-{role.role}"
			role={tabs.length > 1 ? 'tabpanel' : undefined}
			aria-labelledby={tabs.length > 1 ? `tab-${role.role}` : undefined}
		>
			{#if tabs.length === 1}
				<h3 class="mb-3 flex items-baseline gap-2 text-lg font-semibold">
					{role.title}
					<span class="text-sm font-normal text-base-content/40">{role.works.length}</span>
				</h3>
			{/if}
			<EntityGrid
				row={{ filters: { person: data.person.slug, role: role.role }, sort: 'new' }}
				entities={(all ? role.works : role.works.slice(0, WORKS_SHOWN)).map((w) => w.entity)}
				caption={(e) => captions.get(e.id)}
				{ratings}
			/>
			{#if role.works.length > WORKS_SHOWN}
				<button
					type="button"
					class="btn mt-4 btn-outline btn-sm"
					aria-expanded={all}
					onclick={() => (all ? open.delete(role.role) : open.add(role.role))}
				>
					{all ? 'Свернуть' : `Показать всех (${role.works.length})`}
				</button>
			{/if}
		</section>
	{:else}
		<EmptyState title="Работ пока нет" />
	{/if}
</section>

<!-- Комментарии о человеке: публичный список грузится в браузере. -->
<section class="mt-12" aria-labelledby="comments-title">
	<h2 id="comments-title" class="mb-4 text-xl font-bold">Комментарии</h2>
	<TargetComments kind="person" slug={person.slug} />
</section>
