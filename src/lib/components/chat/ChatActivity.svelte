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
	//
	// Число — бейджем на самой кнопке, а разговор за сутки — зелёной точкой: слово «обсуждают»
	// рядом с иконкой читалось как чужая подпись в ряду кнопок.
	let { meta, kind, slug }: { meta: RoomMeta; kind: string; slug: string } = $props();

	let messages = $state(0);
	let recent = $state(0);

	// На бейдже всегда общее число сообщений, цвет говорит о свежести: зелёный — писали за сутки.
	// В подсказке то же самое словами, и «за сутки» добавляется к общему, а не подменяет его —
	// иначе два числа значили бы разное, а выглядели одинаково.
	const hint = $derived(
		messages
			? `Открыть чат: ${plural(messages, ['сообщение', 'сообщения', 'сообщений'])}` +
					(recent ? `, ${recent} за сутки` : '')
			: 'Открыть чат: пока пусто'
	);
	/** 1 240 на бейдже не помещается — после тысячи «1к». */
	const badge = $derived(messages > 999 ? `${Math.floor(messages / 1000)}к` : String(messages));

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

<span class="indicator">
	{#if messages}
		<span
			class={[
				'indicator-item badge px-1.5 badge-xs',
				recent ? 'badge-success' : 'border-base-300 bg-base-200 text-base-content/70'
			]}>{badge}</span
		>
	{/if}
	<ChatButton {meta} short title={hint} />
</span>
