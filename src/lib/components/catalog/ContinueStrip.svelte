<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { listMyMarks } from '#lib/social/marks.ts';
	import type { CardEntity } from './EntityCard.svelte';
	import PosterStrip from './PosterStrip.svelte';

	// «Продолжить» — отложенное самим человеком. Личное, поэтому грузится в браузере с токеном
	// (главная — общая для всех и кэшируется), а у гостя блока нет вовсе.
	const SIZE = 12;

	let items = $state<CardEntity[]>([]);
	let error = $state('');

	$effect(() => {
		if (session.status !== 'authed') {
			items = [];
			return;
		}
		let stale = false;
		listMyMarks(api, 'later', { limit: SIZE })
			// В social `EntityRef.kind` — строка, а не перечисление: раздел сверяем со своим списком,
			// незнакомый тип просто пропускаем.
			.then(
				(page) =>
					!stale &&
					(items = page.items.flatMap((m) => {
						const kind = KINDS.find((k) => k.kind === m.entity.kind)?.kind;
						return kind ? [{ ...m.entity, kind }] : [];
					}))
			)
			.catch((e) => !stale && (error = errorMessage(e)));
		return () => {
			stale = true;
		};
	});
</script>

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
