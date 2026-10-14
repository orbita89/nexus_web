<script lang="ts">
	import type { SchemaPersonHit } from '#lib/api/generated/catalog.ts';
	import { roleLabel } from '#lib/catalog/labels.ts';
	import PersonAvatar from './PersonAvatar.svelte';

	// Человек в выдаче поиска: фото, имя, имя латиницей (если другое), основная роль (known_for).
	let { person }: { person: SchemaPersonHit } = $props();

	const original = $derived(
		person.original_name && person.original_name !== person.full_name ? person.original_name : null
	);
</script>

<a
	href="/people/{person.slug}"
	class="group flex items-center gap-3 rounded-box p-2 transition-colors hover:bg-base-200"
>
	<PersonAvatar name={person.full_name} photoUrl={person.photo_url} />
	<span class="min-w-0">
		<span class="block truncate font-semibold group-hover:text-primary">{person.full_name}</span>
		{#if original}<span class="block truncate text-xs text-base-content/50">{original}</span>{/if}
		{#if person.known_for}
			<span class="block truncate text-xs text-primary/80">{roleLabel(person.known_for)}</span>
		{/if}
	</span>
</a>
