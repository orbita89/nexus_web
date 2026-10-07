<script lang="ts">
	import { onMount } from 'svelte';
	import { timeAgo } from '#lib/social/forum.ts';
	import { reviewDate } from '#lib/social/reviews.ts';

	// На сервере — дата (одинаковая везде), в браузере — «5 минут назад» и обновление раз в минуту.
	let { iso }: { iso: string } = $props();

	let now = $state<number | null>(null);
	onMount(() => {
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});
</script>

<time datetime={iso} title={new Date(iso).toLocaleString('ru-RU')}
	>{now === null ? reviewDate(iso) : timeAgo(iso, now)}</time
>
