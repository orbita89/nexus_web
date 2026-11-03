<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import type { RoomMeta } from '#lib/chat/rooms.ts';
	import ChatButton from './ChatButton.svelte';

	// «Открыть чат» со счётчиком: пока кнопка выглядит одинаково и при четырёхстах сообщениях, и
	// при пустой комнате, никто не понимает, что произведение обсуждают. Комната публичная
	// (GET /chat/{kind}/{slug} без токена), поэтому спрашиваем её в браузере — страница карточки
	// статическая, число в HTML зашивать нельзя.
	//
	// Числа сообщений у комнаты произведения бэкенд пока не отдаёт (есть только у своих комнат
	// пользователей) — задача docs/backend-tasks/entity-card-social.md. До неё показываем то, что
	// есть: было ли сообщение и когда. Появится messages_count — число встанет на место само.
	let { meta, kind, slug }: { meta: RoomMeta; kind: string; slug: string } = $props();

	type RoomCounts = { messages_count?: number; messages_24h?: number };
	let count = $state<number | null>(null);
	let recent = $state(false);
	let any = $state(false);

	$effect(() => {
		let stale = false;
		unwrap(
			guestApi.social.GET('/api/v1/social/chat/{kind}/{slug}', {
				params: { path: { kind, slug } }
			})
		)
			.then((room) => {
				if (stale) return;
				const counts = room as RoomCounts;
				count = counts.messages_count ?? null;
				any = !!room.last_message || !!count;
				const at = room.last_message?.created_at;
				// «Сейчас обсуждают» — сообщение за последние сутки.
				recent =
					(counts.messages_24h ?? 0) > 0 ||
					(!!at && Date.now() - Date.parse(at) < 24 * 60 * 60 * 1000);
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});
</script>

<span class="inline-flex items-center gap-2">
	<ChatButton {meta} />
	{#if count !== null}
		<span class="text-xs text-base-content/50">{count.toLocaleString('ru-RU')}</span>
	{/if}
	{#if recent}
		<span class="text-xs font-bold text-success">обсуждают</span>
	{:else if any && count === null}
		<span class="text-xs text-base-content/50">есть сообщения</span>
	{/if}
</span>
