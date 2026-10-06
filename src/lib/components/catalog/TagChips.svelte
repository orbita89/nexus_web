<script lang="ts">
	let {
		tags,
		label = 'Теги'
	}: { tags: { slug: string; name: string; entities_count?: number }[]; label?: string } = $props();
</script>

<ul class="flex flex-wrap gap-2" aria-label={label}>
	{#each tags as tag (tag.slug)}
		<li>
			<a
				href="/tags/{tag.slug}"
				class="badge gap-1.5 border-base-300 bg-base-200 badge-lg transition-colors hover:border-primary hover:text-primary"
			>
				{tag.name}
				{#if tag.entities_count !== undefined}
					<span class="text-xs text-base-content/40">{tag.entities_count}</span>
				{/if}
			</a>
		</li>
	{/each}
</ul>
