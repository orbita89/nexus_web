<script lang="ts">
	import { api, session } from '#lib/auth/session.svelte.ts';
	import {
		colorHex,
		inBookOrder,
		listBook,
		readHref,
		type Annotation
	} from '#lib/reader/annotations.ts';

	// «Мои пометки» на странице книги: закладки и выделения читателя, со ссылкой в читалку на
	// место. Страница статическая — блок грузится в браузере и только у вошедшего; пусто — блока нет.
	let { slug }: { slug: string } = $props();

	const SHOWN = 5;
	let items = $state<Annotation[]>([]);

	$effect(() => {
		if (session.status !== 'authed') {
			items = [];
			return;
		}
		let stale = false;
		listBook(api, slug)
			.then((list) => !stale && (items = inBookOrder(list)))
			.catch(() => {});
		return () => {
			stale = true;
		};
	});

	const username = $derived(session.user?.username);
</script>

{#if items.length}
	<section class="mt-10" aria-labelledby="my-marks">
		<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
			<h2 id="my-marks" class="text-2xl font-bold">Мои пометки</h2>
			<span class="text-sm text-base-content/50">видны только вам</span>
		</div>
		<ul class="flex flex-col gap-2">
			{#each items.slice(0, SHOWN) as a (a.id)}
				<li>
					<a
						href={readHref(slug, a.cfi)}
						class="block rounded-box bg-base-200 p-3 ring-1 ring-base-300 transition-colors hover:ring-primary/50"
						style="border-left:4px solid {a.kind === 'highlight'
							? colorHex(a.color)
							: 'var(--color-primary)'}"
					>
						<span class="block text-xs text-base-content/50">
							{a.kind === 'bookmark' ? 'Закладка' : 'Выделение'}{a.chapter
								? ` · ${a.chapter}`
								: ''}{a.fraction != null ? ` · ${Math.round(a.fraction * 100)}%` : ''}
						</span>
						{#if a.text}<span class="line-clamp-2 block text-sm">«{a.text}»</span>{/if}
						{#if a.note}<span class="mt-1 line-clamp-2 block text-sm text-base-content/70 italic"
								>{a.note}</span
							>{/if}
					</a>
				</li>
			{/each}
		</ul>
		{#if items.length > SHOWN && username}
			<a href="/u/{username}/books" class="mt-3 inline-block link text-sm link-primary"
				>Все пометки ({items.length})</a
			>
		{/if}
	</section>
{/if}
