<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { message }: { message: string } = $props();

	let retrying = $state(false);
	async function retry() {
		retrying = true;
		try {
			await invalidateAll();
		} finally {
			retrying = false;
		}
	}
</script>

<div role="alert" class="alert alert-soft alert-error">
	<span>Не удалось загрузить. {message}</span>
	<button class="btn btn-sm" onclick={retry} disabled={retrying}>Повторить</button>
</div>
