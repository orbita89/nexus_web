<script lang="ts">
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { aboutTitle, keyFactRows } from '#lib/catalog/card.ts';

	// Плашка фактов: только основные факты. Описание — внизу, в About.svelte, рядом со студиями.
	// На телефоне (< md) — на всю ширину экрана, факты в сетке 2×2 (подпись над значением);
	// на md и шире — ширина по содержимому, подпись и значение в две колонки.
	let { entity }: { entity: SchemaEntityDetail } = $props();

	const rows = $derived(keyFactRows(entity));
</script>

{#if rows.length}
	<section aria-label={aboutTitle(entity.kind)} class="relative z-0 mt-0 min-w-0 md:mt-8 md:max-w-2xl">
		<dl
			class="grid w-full max-w-full grid-cols-2 gap-x-4 gap-y-2.5 overflow-hidden rounded-box bg-base-200 p-2.5 ring-1 ring-base-content/5 md:w-fit md:grid-cols-1 md:gap-y-2 md:p-7"
		>
			{#each rows as row (row.label)}
				<div class="grid min-w-0 grid-cols-1 gap-0.5 md:grid-cols-[auto_1fr] md:gap-x-6">
					<dt class="text-left text-[11px] leading-tight text-base-content/50 md:text-sm">{row.label}</dt>
					<dd
						class="min-w-0 truncate text-xs leading-snug md:overflow-visible md:whitespace-normal md:text-clip md:text-sm"
					>
						{#if row.links}
							{#each row.links as link, i (link.href)}{i ? ', ' : ''}<a
									href={link.href}
									class="font-medium underline decoration-base-content/20 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/60"
									>{link.text}</a
								>{/each}{#if row.more}, <a
									href="#credits"
									class="whitespace-nowrap text-primary/80 hover:text-primary hover:underline"
									>ещё {row.more}</a
								>{/if}
						{:else}
							{row.text}
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</section>
{/if}
