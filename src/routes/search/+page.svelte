<script lang="ts">
	import { page } from '$app/state';
	import Stub from '#lib/components/Stub.svelte';
</script>

<Stub
	title={page.url.searchParams.get('q') ? `Поиск: ${page.url.searchParams.get('q')}` : 'Поиск'}
	description="Поиск по каталогу — скоро."
/>
