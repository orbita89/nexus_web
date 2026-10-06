<script lang="ts">
	let {
		user,
		size = 'w-8'
	}: {
		user: { username: string; display_name?: string | null; avatar_url?: string | null };
		size?: string;
	} = $props();

	const initial = $derived((user.display_name || user.username).slice(0, 1).toUpperCase());
</script>

{#if user.avatar_url}
	<div class="avatar">
		<div class="{size} rounded-full">
			<img src={user.avatar_url} alt="" referrerpolicy="no-referrer" />
		</div>
	</div>
{:else}
	<div class="avatar avatar-placeholder">
		<div class="{size} rounded-full bg-neutral text-neutral-content">
			<span>{initial}</span>
		</div>
	</div>
{/if}
