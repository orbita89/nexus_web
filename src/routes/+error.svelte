<script lang="ts">
	import { page } from '$app/state';

	// 404 от load — с нашим текстом («Студия не найдена.»); у адреса без маршрута SvelteKit пишет
	// «Not Found» — вместо него общий текст.
	const message = $derived(
		page.status === 404
			? page.error?.message && page.error.message !== 'Not Found'
				? page.error.message
				: 'Такой страницы нет.'
			: (page.error?.message ?? 'Что-то пошло не так.')
	);
</script>

<svelte:head>
	<title>{page.status} — Nexus</title>
</svelte:head>

<div class="hero py-16">
	<div class="hero-content text-center">
		<div>
			<h1 class="text-5xl font-bold">{page.status}</h1>
			<p class="py-4">{message}</p>
			<a href="/" class="btn btn-primary">На главную</a>
		</div>
	</div>
</div>
