<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { SchemaEntityCredit } from '#lib/api/generated/catalog.ts';
	import type { CreditGroup } from '#lib/catalog/card.ts';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';

	// «Съёмочная группа и актёры»: группы по ролям (режиссёры, сценаристы, … , в ролях). В каждой
	// сразу видны первые group.shown, остальные — по «Показать всех (K)» из тех же данных карточки,
	// без запросов. В статический HTML попадает только видимая часть: у популярных фильмов 100+
	// актёров. Съёмочная группа — колонками, актёры — на всю ширину.
	let { groups }: { groups: CreditGroup[] } = $props();

	const CAST = ['actor', 'voice_actor'];
	const open = new SvelteSet<string>();
</script>

{#snippet person(credit: SchemaEntityCredit)}
	<li class="min-w-0">
		<a
			href="/people/{credit.person.slug}"
			class="group -mx-2 flex items-center gap-3 rounded-box px-2 py-1.5 transition-colors hover:bg-base-content/5"
		>
			<PersonAvatar name={credit.person.full_name} photoUrl={credit.person.photo_url} size="sm" />
			<span class="min-w-0">
				<span class="block truncate text-sm font-medium group-hover:text-primary"
					>{credit.person.full_name}</span
				>
				{#if credit.character_name}
					<span class="block truncate text-xs text-base-content/45">{credit.character_name}</span>
				{/if}
			</span>
		</a>
	</li>
{/snippet}

<div
	id="credits"
	class="grid scroll-mt-32 gap-x-8 gap-y-6 rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:grid-cols-2 sm:p-7 md:scroll-mt-20 lg:grid-cols-3"
	role="group"
	aria-label="Съёмочная группа и актёры"
>
	{#each groups as group (group.role)}
		{@const cast = CAST.includes(group.role)}
		{@const all = open.has(group.role)}
		<div class={['min-w-0', { 'sm:col-span-2 lg:col-span-3': cast }]}>
			<h3
				class="mb-2 flex items-baseline gap-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase"
			>
				{group.title}
				{#if group.credits.length > 1}<span class="font-normal tracking-normal text-base-content/35"
						>{group.credits.length}</span
					>{/if}
			</h3>
			<ul
				class={['grid gap-x-6', { 'sm:grid-cols-2 lg:grid-cols-3': cast }]}
				aria-label={group.title}
			>
				{#each all ? group.credits : group.credits.slice(0, group.shown) as credit (credit.id)}
					{@render person(credit)}
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
</div>
