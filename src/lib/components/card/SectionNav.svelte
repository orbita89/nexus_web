<script lang="ts">
	// Навигация по разделам карточки: она длинная — «О фильме», титры, награды, связанные,
	// рекомендации, рецензии, коллекции. Без неё до обсуждений нужно долго крутить, а что на
	// странице вообще есть — не видно. Полоса прилипает под шапкой сайта и появляется, когда
	// первый экран ушёл вверх (тот же приём, что у StickyHeader).
	let {
		hero,
		sections
	}: {
		hero: HTMLElement | undefined;
		/** Якорь и подпись; передаём только существующие разделы. */
		sections: { id: string; title: string }[];
	} = $props();

	let shown = $state(false);
	let active = $state('');

	$effect(() => {
		if (!hero) return;
		// Шапка сайта — 4rem: карточка «ушла», когда её низ скрылся под ней.
		const observer = new IntersectionObserver(
			([entry]) => (shown = !entry.isIntersecting && entry.boundingClientRect.top < 0),
			{ rootMargin: '-64px 0px 0px 0px' }
		);
		observer.observe(hero);
		return () => observer.disconnect();
	});

	// Подсветка текущего раздела: верхняя треть экрана — то, что человек сейчас читает.
	$effect(() => {
		const ids = sections.map((s) => s.id);
		const nodes = ids
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => !!el);
		if (!nodes.length) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				if (visible) active = visible.target.id;
			},
			{ rootMargin: '-96px 0px -66% 0px' }
		);
		for (const node of nodes) observer.observe(node);
		return () => observer.disconnect();
	});
</script>

{#if sections.length > 1}
	<nav
		class={[
			// fixed, а не sticky: скрытая полоса не должна занимать место в потоке — из-за него
			// между трейлером и «О фильме» зиял пустой экран. На телефоне встаёт под липкой
			// шапкой карточки (StickyHeader), иначе перекрыла бы её.
			'fixed inset-x-0 top-[6.75rem] z-10 border-b border-base-300 bg-base-100/90 backdrop-blur-md transition duration-200 md:top-16',
			shown ? 'opacity-100' : 'pointer-events-none opacity-0'
		]}
		aria-label="Разделы страницы"
	>
		<!-- Узкий экран листает строку: разделов до семи, в 390 px они не помещаются. -->
		<ul class="scrollbar-hide mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
			{#each sections as section (section.id)}
				<li>
					<a
						href="#{section.id}"
						aria-current={active === section.id ? 'true' : undefined}
						class={[
							'block rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
							active === section.id
								? 'bg-primary/15 font-semibold text-primary'
								: 'text-base-content/60 hover:bg-base-200 hover:text-base-content'
						]}>{section.title}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
