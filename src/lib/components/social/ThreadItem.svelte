<script lang="ts">
	import type { SchemaThread } from '#lib/api/generated/social.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { displayName, reviewDate } from '#lib/social/reviews.ts';

	let { thread, showAuthor = true }: { thread: SchemaThread; showAuthor?: boolean } = $props();
</script>

<article class="rounded-box bg-base-200 p-4 ring-1 ring-base-300 transition hover:ring-primary/50">
	<h3 class="flex flex-wrap items-center gap-2 text-lg leading-snug font-semibold">
		<a href="/forum/{thread.id}" class="hover:text-primary">{thread.title}</a>
		{#if thread.is_locked}<span class="badge badge-ghost badge-sm">закрыта</span>{/if}
	</h3>
	{#if thread.entities.length}
		<ul class="mt-2 flex flex-wrap gap-1.5" aria-label="Произведения темы">
			{#each thread.entities as entity (entity.id)}
				{@const href = refHref(entity)}
				<li>
					{#if href}
						<a
							{href}
							class="badge border-base-300 bg-base-100 badge-sm hover:border-primary hover:text-primary"
							>{entity.title}</a
						>
					{:else}
						<span class="badge badge-sm">{entity.title}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<p class="mt-2 text-xs text-base-content/50">
		{#if showAuthor}
			<a href="/u/{thread.author.username}" class="hover:text-primary"
				>{displayName(thread.author)}</a
			> ·
		{/if}
		{count(thread.posts_count, ['сообщение', 'сообщения', 'сообщений'])} · активность
		<time datetime={thread.last_post_at}>{reviewDate(thread.last_post_at)}</time>
	</p>
</article>
