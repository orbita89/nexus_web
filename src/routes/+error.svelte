<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Nexus</title>
</svelte:head>

<div class="hero py-16">
	<div class="hero-content text-center">
		<div>
			<h1 class="text-5xl font-bold">{page.status}</h1>
			<p class="py-4">
				{page.status === 404
					? 'Такой страницы нет.'
					: (page.error?.message ?? 'Что-то пошло не так.')}
			</p>
			<a href="/" class="btn btn-primary">На главную</a>
		</div>
	</div>
</div>
