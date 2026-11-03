<script lang="ts">
	import type { SchemaPersonHit } from '#lib/api/generated/catalog.ts';
	import PersonAvatar from './PersonAvatar.svelte';

	// Люди лентой: круглые портреты читаются с одного взгляда и не спорят с прямоугольными
	// постерами выше — страница получает другой ритм, а не шестую полосу обложек.
	let { people, label = 'Люди' }: { people: SchemaPersonHit[]; label?: string } = $props();
</script>

<ul class="scrollbar-hide -mx-1.5 flex snap-x gap-4 overflow-x-auto px-1.5 py-1" aria-label={label}>
	{#each people as person (person.id)}
		<li class="w-24 shrink-0 snap-start sm:w-28">
			<a
				href="/people/{person.slug}"
				class="group flex flex-col items-center gap-2 rounded-box p-1 text-center"
			>
				<span class="transition duration-300 group-hover:scale-105">
					<PersonAvatar name={person.full_name} photoUrl={person.photo_url} />
				</span>
				<span class="line-clamp-2 text-xs leading-snug font-medium group-hover:text-primary"
					>{person.full_name}</span
				>
			</a>
		</li>
	{/each}
</ul>
