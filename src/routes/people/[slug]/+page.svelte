<script lang="ts">
	import { count, formatDate, groupWorks, summary } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const person = $derived(data.person);
	const works = $derived(groupWorks(person.credits));
	const captions = $derived(new Map(works.map((w) => [w.entity.id, w.caption])));
</script>

<Seo
	title={person.full_name}
	description={summary(person.bio) || `${person.full_name}: фильмы, сериалы, книги и игры в Nexus.`}
	image={person.photo_url}
/>

<header
	class="mb-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left"
>
	<PersonAvatar name={person.full_name} photoUrl={person.photo_url} size="lg" />
	<div class="min-w-0">
		<p class="text-xs font-semibold tracking-widest text-primary uppercase">Человек</p>
		<h1 class="mt-1 text-3xl font-black sm:text-5xl">{person.full_name}</h1>
		{#if person.birth_date}
			<p class="mt-2 text-sm text-base-content/50">
				Дата рождения: {formatDate(person.birth_date)}
			</p>
		{/if}
		{#if person.bio}
			<p class="mt-4 max-w-2xl leading-relaxed whitespace-pre-line text-base-content/80">
				{person.bio}
			</p>
		{/if}
	</div>
</header>

<section aria-labelledby="works-title">
	<h2 id="works-title" class="mb-4 text-xl font-bold">
		Работы
		{#if works.length}<span class="ml-1 text-sm font-normal text-base-content/40"
				>{count(works.length, ['работа', 'работы', 'работ'])}</span
			>{/if}
	</h2>
	{#if works.length}
		<EntityGrid
			entities={works.map((w) => w.entity)}
			caption={(e) => captions.get(e.id)}
			showKind
		/>
	{:else}
		<EmptyState title="Работ пока нет" />
	{/if}
</section>
