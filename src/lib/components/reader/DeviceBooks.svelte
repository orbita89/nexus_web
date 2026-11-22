<script lang="ts">
	import { onMount } from 'svelte';
	import { cacheUsage, idbCache } from '#lib/reader/cache.ts';

	// «Книги на устройстве»: сколько места занимают сохранённые для читалки книги и кнопка
	// «Очистить». Размер — сумма самих книг в IndexedDB (navigator.storage.estimate() считал бы
	// весь сайт вместе с кэшем браузера).
	let usage = $state<{ count: number; bytes: number } | null>(null);
	let busy = $state(false);

	async function load() {
		usage = await cacheUsage(idbCache).catch(() => ({ count: 0, bytes: 0 }));
	}

	onMount(() => void load());

	async function clear() {
		busy = true;
		await idbCache.clear().catch(() => {});
		await load();
		busy = false;
	}

	const mb = (bytes: number) =>
		(bytes / 1024 / 1024).toLocaleString('ru', { maximumFractionDigits: bytes < 10e6 ? 1 : 0 });
</script>

<fieldset class="fieldset">
	<legend class="fieldset-legend">Книги на устройстве</legend>
	<div class="flex flex-wrap items-center gap-3">
		<span>
			{#if usage === null}
				Считаем…
			{:else}
				Сохранено на устройстве: {mb(usage.bytes)} МБ{usage.count ? ` (книг: ${usage.count})` : ''}
			{/if}
		</span>
		<button type="button" class="btn btn-sm" disabled={busy || !usage?.count} onclick={clear}
			>Очистить</button
		>
	</div>
	<p class="label text-wrap">
		Открытые книги сохраняются в браузере и в следующий раз открываются сразу. Закрытые книги
		удаляются сами через 30 дней и при выходе из аккаунта.
	</p>
</fieldset>
