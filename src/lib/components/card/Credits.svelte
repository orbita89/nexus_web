<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { SchemaEntityCredit, SchemaPersonRef } from '#lib/api/generated/catalog.ts';
	import type { CreditGroup } from '#lib/catalog/card.ts';
	import { roleLabel } from '#lib/catalog/labels.ts';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';

	// Титры: вкладка «В РОЛЯХ» (актёры, по группам с «Показать всех») и вкладка «СОЗДАТЕЛИ» —
	// все остальные участники проекта, один человек — одна карточка с его ролями через запятую.
	let { groups }: { groups: CreditGroup[] } = $props();

	const CAST = ['actor', 'voice_actor'];
	const castGroups = $derived(groups.filter((g) => CAST.includes(g.role)));
	const crewGroups = $derived(groups.filter((g) => !CAST.includes(g.role)));

	/** Создатели: человек из нескольких ролей — одна карточка; роли — в порядке групп. */
	const creators = $derived.by(() => {
		const byPerson = new Map<string, { person: SchemaPersonRef; roles: string[] }>();
		for (const group of crewGroups) {
			for (const credit of group.credits) {
				const key = String(credit.person.id);
				const entry = byPerson.get(key) ?? { person: credit.person, roles: [] };
				const label = roleLabel(group.role);
				if (!entry.roles.includes(label)) entry.roles.push(label);
				byPerson.set(key, entry);
			}
		}
		return [...byPerson.entries()].map(([key, v]) => ({ key, person: v.person, roles: v.roles }));
	});

	const castCount = $derived(castGroups.reduce((n, g) => n + g.credits.length, 0));
	const hasCast = $derived(castGroups.length > 0);
	const hasCreators = $derived(creators.length > 0);
	const hasTabs = $derived(hasCast && hasCreators);

	let tab = $state<'cast' | 'creators'>('cast');
	const active = $derived(hasCast && (tab === 'cast' || !hasCreators) ? 'cast' : 'creators');

	const open = new SvelteSet<string>();
</script>

{#snippet avatarLine(name: string, photoUrl: string | null | undefined, slug: string, sub?: string)}
	<a
		href="/people/{slug}"
		class="group -mx-2 flex items-center gap-3 rounded-box px-2 py-1.5 transition-colors hover:bg-base-content/5"
	>
		<PersonAvatar {name} {photoUrl} size="sm" />
		<span class="min-w-0">
			<span class="block truncate text-sm font-medium group-hover:text-primary">{name}</span>
			{#if sub}
				<span class="block truncate text-xs text-base-content/45">{sub}</span>
			{/if}
		</span>
	</a>
{/snippet}

<div
	id="credits"
	class="grid scroll-mt-32 gap-x-8 gap-y-6 rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:grid-cols-2 sm:p-7 md:scroll-mt-28 lg:grid-cols-3"
	role="group"
	aria-label="Съёмочная группа и актёры"
>
	{#if hasTabs}
		<div
			class="flex items-baseline gap-6 border-b border-base-content/10 sm:col-span-2 lg:col-span-3"
			role="tablist"
		>
			<button
				type="button"
				role="tab"
				aria-selected={active === 'cast'}
				class={[
					'-mb-px border-b-2 pb-2 text-xs font-semibold tracking-widest uppercase transition-colors',
					active === 'cast'
						? 'border-primary text-base-content'
						: 'border-transparent text-base-content/50 hover:text-base-content'
				]}
				onclick={() => (tab = 'cast')}
			>
				В ролях <span class="font-normal tracking-normal text-base-content/35">{castCount}</span>
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={active === 'creators'}
				class={[
					'-mb-px border-b-2 pb-2 text-xs font-semibold tracking-widest uppercase transition-colors',
					active === 'creators'
						? 'border-primary text-base-content'
						: 'border-transparent text-base-content/50 hover:text-base-content'
				]}
				onclick={() => (tab = 'creators')}
			>
				Создатели <span class="font-normal tracking-normal text-base-content/35">{creators.length}</span>
			</button>
		</div>
	{/if}

	{#if active === 'cast'}
		{#each castGroups as group (group.role)}
			{@const all = open.has(group.role)}
			<div class="min-w-0 sm:col-span-2 lg:col-span-3">
				{#if !hasTabs || group.role !== 'actor'}
					<h3
						class="mb-2 flex items-baseline gap-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase"
					>
						{group.title}
						{#if group.credits.length > 1}<span
								class="font-normal tracking-normal text-base-content/35">{group.credits.length}</span
							>{/if}
					</h3>
				{/if}
				<ul class="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={group.title}>
					{#each all ? group.credits : group.credits.slice(0, group.shown) as credit (credit.id)}
						<li class="min-w-0">
							{@render avatarLine(
								credit.person.full_name,
								credit.person.photo_url,
								credit.person.slug,
								credit.character_name ?? undefined
							)}
						</li>
					{/each}
				</ul>
				{#if group.credits.length > group.shown}
					<button
						type="button"
						class="mt-1 cursor-pointer text-sm text-primary hover:underline"
						aria-expanded={all}
						onclick={() => (all ? open.delete(group.role) : open.add(group.role))}
					>
						{all ? 'Свернуть' : `Показать всех (${group.credits.length})`}
					</button>
				{/if}
			</div>
		{/each}
	{:else}
		<ul class="grid gap-x-6 gap-y-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
			{#each creators as creator (creator.key)}
				<li class="min-w-0">
					{@render avatarLine(
						creator.person.full_name,
						creator.person.photo_url,
						creator.person.slug,
						creator.roles.join(', ')
					)}
				</li>
			{/each}
		</ul>
	{/if}
</div>
