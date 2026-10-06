<script lang="ts">
	import { KINDS } from '#lib/catalog/kinds.ts';
</script>

<svelte:head>
	<title>Nexus — фильмы, сериалы, книги и игры</title>
</svelte:head>

<section class="mb-8">
	<h1 class="text-3xl font-bold">Nexus</h1>
	<p class="mt-2 text-base-content/70">
		Каталог фильмов, сериалов, книг и игр. Оценки, рецензии, коллекции и обсуждения.
	</p>
</section>

<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
	{#each KINDS as k (k.slug)}
		<a href="/{k.slug}" class="card bg-base-200 transition-colors hover:bg-base-300">
			<div class="card-body items-center py-10">
				<h2 class="card-title">{k.title}</h2>
			</div>
		</a>
	{/each}
</div>
