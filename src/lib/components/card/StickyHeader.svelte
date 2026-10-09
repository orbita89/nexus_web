<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import type { Watch } from '#lib/social/watch.svelte.ts';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import WatchButton from '#lib/components/social/WatchButton.svelte';

	// Липкая шапка карточки на телефоне: мини-постер, название и колокольчик «Следить» — чтобы
	// подписаться в любой момент, читая обсуждения. Выезжает под основной шапкой сайта, когда
	// первый экран карточки (hero) ушёл вверх. На десктопе её нет.
	let {
		hero,
		title,
		kind,
		coverUrl,
		watch
	}: {
		hero: HTMLElement | undefined;
		title: string;
		kind: SchemaEntityKind;
		coverUrl?: string | null;
		watch: Watch;
	} = $props();

	let shown = $state(false);

	$effect(() => {
		if (!hero) return;
		// Шапка сайта — 4rem: шапка карточки «ушла», когда её низ скрылся под ней.
		const observer = new IntersectionObserver(
			([entry]) => (shown = !entry.isIntersecting && entry.boundingClientRect.top < 0),
			{ rootMargin: '-64px 0px 0px 0px' }
		);
		observer.observe(hero);
		return () => observer.disconnect();
	});
</script>

<div
	class={[
		'fixed inset-x-0 top-16 z-10 border-b border-base-300 bg-base-100/90 backdrop-blur-md transition duration-200 md:hidden',
		shown ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
	]}
	inert={!shown}
	aria-hidden={!shown || undefined}
	data-testid="sticky-header"
>
	<div class="flex items-center gap-3 px-4 py-2">
		<button
			class="flex min-w-0 flex-1 items-center gap-3 text-left"
			onclick={() => scrollTo({ top: 0, behavior: 'smooth' })}
			aria-label="Наверх: {title}"
		>
			<span class="w-7 shrink-0"><Poster {title} {kind} {coverUrl} small /></span>
			<span class="truncate font-semibold">{title}</span>
		</button>
		<WatchButton {watch} compact />
	</div>
</div>
