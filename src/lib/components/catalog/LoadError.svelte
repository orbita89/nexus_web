<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	// onretry — повторить свой запрос (блоки, которые грузят данные сами); по умолчанию — load страницы.
	let { message, onretry }: { message: string; onretry?: () => unknown } = $props();

	let retrying = $state(false);
	async function retry() {
		retrying = true;
		try {
			await (onretry ?? invalidateAll)();
		} finally {
			retrying = false;
		}
	}
</script>

<div role="alert" class="alert alert-soft alert-error">
	<span>Не удалось загрузить. {message}</span>
	<button class="btn btn-sm" onclick={retry} disabled={retrying}>Повторить</button>
</div>
