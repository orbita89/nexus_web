<script lang="ts">
	import type { SchemaUserRef } from '#lib/api/generated/social.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import Avatar from '#lib/components/Avatar.svelte';

	let { user, caption }: { user: SchemaUserRef; caption?: string } = $props();
</script>

<a
	href="/u/{user.username}"
	class="group flex items-center gap-3 rounded-box bg-base-200 p-3 ring-1 ring-base-300 transition hover:ring-primary/60"
>
	<Avatar {user} size="w-11" />
	<span class="min-w-0">
		<span class="block truncate font-semibold group-hover:text-primary">{displayName(user)}</span>
		<span class="block truncate text-xs text-base-content/50"
			>@{user.username}{#if caption}
				· {caption}{/if}</span
		>
	</span>
</a>
