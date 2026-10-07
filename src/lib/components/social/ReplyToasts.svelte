<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { guestApi, session } from '#lib/auth/session.svelte.ts';
	import { useRealtime } from '#lib/realtime/realtime.svelte.ts';

	// «Вам ответили»: событие reply.created в личный канал user:me (после входа). В событии только
	// id — заголовок темы дочитываем по API. Уведомления живут, пока открыта вкладка.
	interface Toast {
		id: string;
		title: string;
		href: string;
	}
	let toasts = $state<Toast[]>([]);

	useRealtime(
		() => (session.status === 'authed' ? ['user:me'] : []),
		async (event) => {
			if (event.event !== 'reply.created') return;
			const threadId = String(event.data.thread_id);
			const postId = String(event.data.post_id);
			let title = 'тема';
			try {
				const thread = await unwrap(
					guestApi.social.GET('/api/v1/social/threads/{id}', {
						params: { path: { id: threadId }, query: { limit: 1 } }
					})
				);
				title = thread.title;
			} catch {
				// тема уже удалена — покажем без заголовка
			}
			const toast = { id: postId, title, href: `/forum/${threadId}?post=${postId}#post-${postId}` };
			toasts = [...toasts.slice(-2), toast];
			setTimeout(() => (toasts = toasts.filter((t) => t !== toast)), 15_000);
		}
	);
</script>

{#if toasts.length}
	<div class="toast z-50" role="status" aria-live="polite">
		{#each toasts as toast (toast.id)}
			<div class="alert items-start bg-base-200 shadow-xl ring-1 ring-primary/40">
				<span class="text-xl" aria-hidden="true">💬</span>
				<div class="min-w-0">
					<p class="font-semibold">Вам ответили</p>
					<a
						href={toast.href}
						class="line-clamp-2 link text-sm text-primary link-hover"
						onclick={() => (toasts = toasts.filter((t) => t !== toast))}>{toast.title}</a
					>
				</div>
				<button
					class="btn btn-square btn-ghost btn-xs"
					aria-label="Закрыть уведомление"
					onclick={() => (toasts = toasts.filter((t) => t !== toast))}>✕</button
				>
			</div>
		{/each}
	</div>
{/if}
