<script lang="ts">
	import { api } from '#lib/auth/session.svelte.ts';
	import { asKind, entityHref } from '#lib/catalog/kinds.ts';
	import { loadJournal, type JournalItem } from '#lib/social/journal.ts';

	// Последние записи журнала — ряд мини-постеров в правой колонке шапки. Блок необязательный:
	// если данных нет или запрос упал, ничего не выводим.
	const SHOWN = 4;

	let { username, isOwner, base }: { username: string; isOwner: boolean; base: string } = $props();

	let items = $state<JournalItem[]>([]);

	$effect(() => {
		let stale = false;
		loadJournal(api, username, { filter: 'all', limit: SHOWN }, isOwner)
			.then((p) => !stale && (items = p.items.slice(0, SHOWN)))
			.catch(() => !stale && (items = []));
		return () => {
			stale = true;
		};
	});
</script>

{#if items.length}
	<section class="flex w-full flex-col items-start gap-2 md:items-end" aria-label="Последнее в журнале">
		<a
			href="{base}/journal"
			class="text-xs font-semibold tracking-wide text-base-content/50 uppercase transition-colors hover:text-primary"
		>
			Последнее в журнале
		</a>
		<ul class="flex gap-2">
			{#each items as item (item.entity.id)}
				{@const kind = asKind(item.entity.kind)}
				<li class="shrink-0">
					<a
						href={kind ? entityHref({ kind, slug: item.entity.slug }) : `${base}/journal`}
						title={item.entity.title}
						class="block h-[72px] w-12 overflow-hidden rounded-lg bg-base-300 ring-1 ring-base-content/10 transition-transform hover:scale-105"
					>
						{#if item.entity.cover_url}
							<img
								src={item.entity.cover_url}
								alt={item.entity.title}
								loading="lazy"
								class="size-full object-cover"
							/>
						{:else}
							<span
								class="grid size-full place-items-center text-xs text-base-content/40"
								aria-hidden="true">{item.entity.title.slice(0, 1)}</span
							>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
