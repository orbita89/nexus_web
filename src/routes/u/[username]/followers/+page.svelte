<script lang="ts">
	import { displayName } from '#lib/social/reviews.ts';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import FollowList from '#lib/components/social/FollowList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
</script>

<Seo title="Подписчики — {displayName(user)} (@{user.username})" />
<FollowList list={data.list} label="Подписчики" empty="Подписчиков пока нет" />
