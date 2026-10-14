<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { count, formatDate, summary, WORKS_SHOWN } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Фильмография по ролям (data.roles): главная роль человека — первой, внутри — новые сверху.
	// Длинный список — первые WORKS_SHOWN, остальное — «Показать всех» без запросов.
	const person = $derived(data.person);
	const total = $derived(new Set(person.credits.map((c) => c.entity.id)).size);
	const open = new SvelteSet<string>();
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
		{#if person.original_name && person.original_name !== person.full_name}
			<p class="mt-1 text-lg text-base-content/50">{person.original_name}</p>
		{/if}
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
	<h2 id="works-title" class="mb-6 text-xl font-bold">
		Фильмография
		{#if total}<span class="ml-1 text-sm font-normal text-base-content/40"
				>{count(total, ['работа', 'работы', 'работ'])}</span
			>{/if}
	</h2>
	{#each data.roles as role (role.role)}
		{@const all = open.has(role.role)}
		{@const captions = new Map(role.works.map((w) => [w.entity.id, w.caption]))}
		<section class="mb-10" aria-labelledby="role-{role.role}">
			<h3 id="role-{role.role}" class="mb-3 flex items-baseline gap-2 text-lg font-semibold">
				{role.title}
				<span class="text-sm font-normal text-base-content/40">{role.works.length}</span>
			</h3>
			<EntityGrid
				entities={(all ? role.works : role.works.slice(0, WORKS_SHOWN)).map((w) => w.entity)}
				caption={(e) => captions.get(e.id)}
				ratings={data.ratings}
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
	{/each}
</section>
