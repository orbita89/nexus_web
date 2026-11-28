<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { laterKnownEmpty, listMyMarks, rememberLaterEmpty } from '#lib/social/marks.ts';
	import type { CardEntity } from './EntityCard.svelte';
	import PosterStrip from './PosterStrip.svelte';

	// «Отложено» — отложенное самим человеком. Личное, поэтому грузится в браузере с токеном
	// (главная — общая для всех и лежит готовым файлом), а у гостя блока нет вовсе. Блок стоит
	// ниже каталога, и запрос уходит, только когда до него докрутили (или он уже рядом с экраном);
	// если на этом устройстве уже известно, что отложенного нет, сервер не спрашиваем вовсе.
	const SIZE = 12;

	let items = $state<CardEntity[]>([]);
	let error = $state('');
	let anchor = $state<HTMLElement>();
	let near = $state(false);

	$effect(() => {
		if (near || !anchor || session.status !== 'authed') return;
		// Без IntersectionObserver (старые браузеры) — грузим сразу, как раньше.
		if (typeof IntersectionObserver === 'undefined') return void (near = true);
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) near = true;
			},
			{ rootMargin: '400px 0px' }
		);
		observer.observe(anchor);
		return () => observer.disconnect();
	});

	$effect(() => {
		const user = session.user;
		if (session.status !== 'authed' || !user) {
			items = [];
			return;
		}
		if (!near || laterKnownEmpty(user.username)) return;
		let stale = false;
		listMyMarks(api, 'later', { limit: SIZE })
			// В social `EntityRef.kind` — строка, а не перечисление: раздел сверяем со своим списком,
			// незнакомый тип просто пропускаем.
			.then((page) => {
				if (stale) return;
				rememberLaterEmpty(user.username, page.total === 0);
				items = page.items.flatMap((m) => {
					const kind = KINDS.find((k) => k.kind === m.entity.kind)?.kind;
					return kind ? [{ ...m.entity, kind }] : [];
				});
			})
			.catch((e) => !stale && (error = errorMessage(e)));
		return () => {
			stale = true;
		};
	});
</script>

<!-- Метка для IntersectionObserver: нулевая высота, у гостя её нет. -->
{#if session.status === 'authed'}<div bind:this={anchor} aria-hidden="true"></div>{/if}

{#if items.length}
	<section class="mb-10" aria-labelledby="continue">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<h2 id="continue" class="text-xl font-bold">
				Отложено
				<span class="ml-1 text-sm font-normal text-base-content/40">вы отметили «позже»</span>
			</h2>
		</div>
		<PosterStrip entities={items} label="Отложено" showKind />
	</section>
{:else if error}
	<!-- Молча: личный блок, которого человек не ждал, не должен кричать об ошибке на главной. -->
{/if}
