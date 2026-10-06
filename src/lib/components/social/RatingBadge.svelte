<script lang="ts">
	import { formatRating, ratingTone } from '#lib/social/reviews.ts';

	let {
		value,
		average = false,
		size = 'md'
	}: {
		value: number;
		/** Средняя оценка: всегда с одним знаком («8,0»). */
		average?: boolean;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	const tone = $derived(ratingTone(value));
	const text = $derived(formatRating(value, { average }));
</script>

<span
	class={[
		'badge border-0 font-bold tabular-nums',
		{
			'badge-success': tone === 'high',
			'badge-warning': tone === 'mid',
			'badge-error': tone === 'low',
			'badge-sm': size === 'sm',
			'text-base badge-lg': size === 'lg'
		}
	]}
	aria-label="{average ? 'Средняя оценка' : 'Оценка'} {text} из 10">{text}</span
>
