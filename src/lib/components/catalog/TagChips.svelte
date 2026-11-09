<script lang="ts">
	// Теги — хештегами, а не обведёнными плашками: это ссылки на соседние темы, а не кнопки.
	// Девять рамок подряд дробили страницу на клетки и спорили с настоящими кнопками рядом;
	// решётка впереди читается как тег мгновенно и не требует обводки вовсе.
	let {
		tags,
		label = 'Теги',
		counts = true
	}: {
		tags: { slug: string; name: string; entities_count?: number }[];
		label?: string;
		/** Числа у тегов: в подборке тем они шум — важно название, а не «15 818». */
		counts?: boolean;
	} = $props();
</script>

<ul class="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label={label}>
	{#each tags as tag (tag.slug)}
		<li>
			<a
				href="/tags/{tag.slug}"
				class="group font-medium text-base-content/70 transition-colors hover:text-primary"
			>
				<!-- Решётка бледнее слова: она метка, а не часть названия. -->
				<span class="text-base-content/35 transition-colors group-hover:text-primary/60">#</span
				>{tag.name}{#if counts && tag.entities_count !== undefined}<span
						class="ml-1.5 text-xs text-base-content/35">{tag.entities_count}</span
					>{/if}
			</a>
		</li>
	{/each}
</ul>
