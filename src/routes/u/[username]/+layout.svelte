<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { plural } from '#lib/catalog/labels.ts';
	import { canSeeStats } from '#lib/social/profile.ts';
	import { ProfileViewer } from '#lib/social/profile-viewer.svelte.ts';
	import { displayName, reviewDate } from '#lib/social/reviews.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import FollowButton from '#lib/components/social/FollowButton.svelte';
	import LikeButton from '#lib/components/social/LikeButton.svelte';
	import MessageButton from '#lib/components/social/MessageButton.svelte';
	import ReputationBadge from '#lib/components/social/ReputationBadge.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const profile = $derived(data.profile);
	const user = $derived(profile.user);
	const base = $derived(`/u/${user.username}`);

	// Один перечитанный с токеном профиль на обе кнопки: «Подписаться» и «Нравится».
	const viewer = new ProfileViewer(() => user.username);

	// Подписались или отписались — счётчик меняется сразу, без перезагрузки шапки.
	let delta = $state(0);
	let deltaFor = $state('');
	const followers = $derived(profile.followers_count + (deltaFor === user.username ? delta : 0));
	function onFollow(change: 1 | -1) {
		if (deltaFor !== user.username) delta = 0;
		deltaFor = user.username;
		delta += change;
	}

	// Аналитика закрыта по умолчанию: вкладки рисуем, только если владелец открыл её всем, либо
	// смотрит он сам или админ. На сервере сессии нет — там видно ровно то, что видно гостю,
	// и свои вкладки владелец получает после гидрации.
	const stats = $derived(canSeeStats(profile, session.user));

	// Подписчиков и подписки во вкладки не выносим: на них уже ведут счётчики в шапке.
	const tabs = $derived([
		{ href: base, title: 'Обзор', n: null },
		{ href: `${base}/reviews`, title: 'Рецензии', n: profile.reviews_count },
		{ href: `${base}/threads`, title: 'Темы', n: profile.threads_count },
		{ href: `${base}/collections`, title: 'Коллекции', n: profile.collections_count },
		// Оценки, отметки и комментарии — разделы «Статистики», своих вкладок у них нет.
		...(stats ? [{ href: `${base}/stats`, title: 'Статистика', n: null }] : [])
	]);
	const isActive = (href: string) => page.url.pathname === href;
</script>

<header class="relative mb-8 overflow-hidden rounded-box bg-base-200 ring-1 ring-base-300">
	<div
		class="h-24 bg-linear-to-br from-primary/35 via-base-300 to-secondary/20 sm:h-32"
		aria-hidden="true"
	></div>
	<div class="flex flex-col gap-4 px-4 pb-4 sm:flex-row sm:items-end sm:px-6 sm:pb-6">
		<div class="-mt-12 w-fit shrink-0 self-start rounded-full ring-4 ring-base-200 sm:-mt-16">
			<Avatar {user} size="w-24 sm:w-32 text-4xl" />
		</div>
		<div class="min-w-0 flex-1">
			<h1 class="truncate text-3xl font-black sm:text-4xl">{displayName(user)}</h1>
			<p class="text-base-content/50">@{user.username}</p>
			{#if profile.bio}
				<p class="mt-2 max-w-2xl leading-relaxed whitespace-pre-line text-base-content/80">
					{profile.bio}
				</p>
			{/if}
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<ReputationBadge reputation={profile.reputation} />
				<span class="text-sm text-base-content/50">
					на сайте с {reviewDate(profile.registered_at)}
				</span>
			</div>
			<p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/70">
				<a href="{base}/followers" class="hover:text-primary"
					><b class="text-base-content tabular-nums">{followers}</b>
					{plural(followers, ['подписчик', 'подписчика', 'подписчиков'])}</a
				>
				<a href="{base}/following" class="hover:text-primary"
					><b class="text-base-content tabular-nums">{profile.following_count}</b>
					{plural(profile.following_count, ['подписка', 'подписки', 'подписок'])}</a
				>
				<span
					><b class="text-base-content tabular-nums">{profile.posts_count}</b>
					{plural(profile.posts_count, ['сообщение', 'сообщения', 'сообщений'])} на форуме</span
				>
			</p>
		</div>
		{#key user.username}
			<div class="flex flex-col items-end gap-2">
				<FollowButton username={user.username} {viewer} onchange={onFollow} />
				<LikeButton username={user.username} count={profile.likes_count} {viewer} />
				<MessageButton username={user.username} />
			</div>
		{/key}
	</div>
	<nav class="overflow-x-auto border-t border-base-300 px-2 sm:px-4" aria-label="Разделы профиля">
		<ul class="flex gap-1">
			{#each tabs as tab (tab.href)}
				<li>
					<a
						href={tab.href}
						data-sveltekit-noscroll
						class={[
							'-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors',
							isActive(tab.href)
								? 'border-primary font-semibold text-base-content'
								: 'border-transparent text-base-content/60 hover:text-base-content'
						]}
						aria-current={isActive(tab.href) ? 'page' : undefined}
					>
						{tab.title}
						{#if tab.n !== null}<span class="text-xs text-base-content/40 tabular-nums"
								>{tab.n}</span
							>{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</header>

{@render children()}
