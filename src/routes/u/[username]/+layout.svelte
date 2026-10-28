<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { plural } from '#lib/catalog/labels.ts';
	import { canSeeStats } from '#lib/social/profile.ts';
	import { ProfileViewer } from '#lib/social/profile-viewer.svelte.ts';
	import { displayName } from '#lib/social/reviews.ts';
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

	// Короткая дата регистрации: «с 11.10.26 г.».
	function shortDate(iso: string): string {
		const d = new Date(iso);
		return `${d.getUTCDate()}.${(d.getUTCMonth() + 1).toString().padStart(2, '0')}.${d.getUTCFullYear() % 100} г.`;
	}
</script>

<header class="relative mb-8 overflow-hidden rounded-box bg-base-200 ring-1 ring-base-300">
	<div
		class="h-24 bg-linear-to-br from-primary/35 via-base-300 to-secondary/20 sm:h-32"
		aria-hidden="true"
	></div>
	<div class="px-4 pb-4 sm:px-6 sm:pb-6">
		<!-- Верхняя строка: слева имя и ник, справа статистика и кнопка профиля -->
		<div
			class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-6"
		>
			<div class="min-w-0 flex-1">
				<h1 class="truncate text-2xl font-black sm:text-3xl">{displayName(user)}</h1>
				<p class="text-base-content/50">@{user.username}</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				<div class="flex flex-col items-end gap-1 text-sm text-base-content/70">
					<a href="{base}/followers" class="flex items-center gap-1 hover:text-primary">
						<b class="text-base-content tabular-nums">{followers}</b>
						{plural(followers, ['подписчик', 'подписчика', 'подписчиков'])}
					</a>
					<a href="{base}/following" class="flex items-center gap-1 hover:text-primary">
						<b class="text-base-content tabular-nums">{profile.following_count}</b>
						{plural(profile.following_count, ['подписка', 'подписки', 'подписок'])}
					</a>
				</div>
				<div class="flex flex-col items-end gap-1">
					<FollowButton username={user.username} {viewer} onchange={onFollow} />
					<MessageButton username={user.username} />
				</div>
			</div>
		</div>

		<!-- Нижняя строка: слева аватар с рейтингом под ним, справа описание и лайк -->
		<div class="mt-6 flex items-start gap-6 border-t border-base-content/10 pt-6">
			<!-- Аватар с рейтингом под ним -->
			<div class="flex flex-col items-center gap-3">
				<div class="w-fit shrink-0 rounded-full ring-4 ring-base-200">
					<Avatar {user} size="w-24 sm:w-32 text-4xl" />
				</div>
				<div class="flex items-center gap-2 text-sm text-base-content/60">
					<ReputationBadge reputation={profile.reputation} size="sm" color="error" />
					<span>с {shortDate(profile.registered_at)}</span>
				</div>
			</div>

			<!-- Описание справа от аватара -->
			<div class="min-w-0 flex-1">
				{#if profile.bio}
					<p class="max-w-2xl leading-relaxed whitespace-pre-line text-base-content/80">
						{profile.bio}
					</p>
				{:else}
					<p class="text-base-content/50">Пользователь не добавил описание профиля.</p>
				{/if}
			</div>

			<!-- Крупный красный лайк -->
			<LikeButton username={user.username} count={profile.likes_count} {viewer} size="lg" red />
		</div>
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
						{#if tab.n !== null}
							<span class="text-xs text-base-content/40 tabular-nums">{tab.n}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</header>

{@render children()}
