<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		kind = 'error',
		children
	}: { kind?: 'error' | 'success' | 'info' | 'warning'; children: Snippet } = $props();
</script>

<div
	role={kind === 'error' ? 'alert' : 'status'}
	class={[
		'alert alert-soft text-sm',
		{
			'alert-error': kind === 'error',
			'alert-success': kind === 'success',
			'alert-info': kind === 'info',
			'alert-warning': kind === 'warning'
		}
	]}
>
	<span>{@render children()}</span>
</div>
