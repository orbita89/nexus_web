<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { count as plural } from '#lib/catalog/labels.ts';
	import type { RoomMeta } from '#lib/chat/rooms.ts';
	import ChatButton from './ChatButton.svelte';

	// «Открыть чат» со счётчиком: без него комната с четырьмя сотнями сообщений выглядит так же,
	// как пустая, и по карточке не понять, что произведение обсуждают. Комната публичная
	// (GET /chat/{kind}/{slug} без токена), поэтому спрашиваем её в браузере — страница карточки
	// статическая, число в HTML зашивать нельзя.
	let { meta, kind, slug }: { meta: RoomMeta; kind: string; slug: string } = $props();

	let messages = $state(0);
	let recent = $state(0);

	$effect(() => {
		const path = { kind, slug };
		let stale = false;
		unwrap(guestApi.social.GET('/api/v1/social/chat/{kind}/{slug}', { params: { path } }))
			.then((room) => {
				if (stale) return;
				messages = room.messages_count;
				recent = room.messages_24h;
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});
</script>

<span class="inline-flex items-center gap-2">
	<ChatButton {meta} short />
	{#if recent}
		<!-- Писали за сутки — здесь разговор идёт прямо сейчас, а не «был когда-то». -->
		<span class="text-xs font-bold text-success" title="{recent} за сутки">обсуждают</span>
	{:else if messages}
		<span class="text-xs text-base-content/50"
			>{plural(messages, ['сообщение', 'сообщения', 'сообщений'])}</span
		>
	{/if}
</span>
