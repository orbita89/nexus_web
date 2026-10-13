<script lang="ts">
	import type { Promotions } from '#lib/admin/promote.svelte.ts';

	// Итоги «Вернуть на сайт»: успех — ссылки на карточку и редактор, ошибка — что случилось.
	let { promotions }: { promotions: Promotions } = $props();
</script>

{#if promotions.toasts.length}
	<div class="toast z-50" role="status" aria-live="polite">
		{#each promotions.toasts as toast (toast.id)}
			<div
				class={[
					'alert items-start bg-base-200 shadow-xl ring-1',
					toast.ok ? 'ring-success/50' : 'ring-error/50'
				]}
			>
				<span class="text-xl" aria-hidden="true">{toast.ok ? '✓' : '!'}</span>
				<div class="min-w-0">
					<p class="font-semibold">{toast.title}</p>
					<p class="line-clamp-2 text-sm text-base-content/70">{toast.message}</p>
					{#if toast.siteHref || toast.editHref}
						<p class="mt-1 flex gap-3 text-sm">
							{#if toast.siteHref}<a href={toast.siteHref} class="link link-primary">Открыть</a
								>{/if}
							{#if toast.editHref}<a href={toast.editHref} class="link link-primary"
									>Редактировать</a
								>{/if}
						</p>
					{/if}
				</div>
				<button
					class="btn btn-square btn-ghost btn-xs"
					aria-label="Закрыть уведомление"
					onclick={() => promotions.dismiss(toast)}>✕</button
				>
			</div>
		{/each}
	</div>
{/if}
