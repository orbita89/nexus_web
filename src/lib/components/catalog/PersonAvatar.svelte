<script lang="ts">
	let {
		name,
		photoUrl,
		size = 'md'
	}: { name: string; photoUrl?: string | null; size?: 'sm' | 'md' | 'lg' } = $props();

	let failed = $state(false);
	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase()
	);
</script>

<div class={['avatar', { 'avatar-placeholder': !photoUrl || failed }]} aria-hidden="true">
	<div
		class={[
			'rounded-full ring-1 ring-base-content/10',
			{
				'w-10': size === 'sm',
				'w-16': size === 'md',
				'w-40 sm:w-48': size === 'lg',
				'bg-linear-to-br from-primary/40 to-base-300 text-base-content': !photoUrl || failed
			}
		]}
	>
		{#if photoUrl && !failed}
			<img src={photoUrl} alt="" loading="lazy" onerror={() => (failed = true)} />
		{:else}
			<span
				class={{ 'text-xs': size === 'sm', 'text-xl': size === 'md', 'text-5xl': size === 'lg' }}
				>{initials}</span
			>
		{/if}
	</div>
</div>
