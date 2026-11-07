<script lang="ts">
	import EntityPage from '#lib/components/card/EntityPage.svelte';
	import type { PageProps } from './$types';

	// Сезон — та же карточка, что у сериала: у него свой slug, а значит свои оценки, рецензии,
	// обсуждения и коллекции, и всё это EntityPage уже умеет. Своё здесь — полоса сезонов с
	// открытым сезоном и лента серий.
	let { data }: PageProps = $props();
</script>

<EntityPage
	entity={data.entity}
	seasons={data.seasons}
	episodes={data.episodes}
	series={data.series}
/>
