<script lang="ts">
	import type { SchemaSocialProfile } from '#lib/api/generated/social.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { plural } from '#lib/catalog/labels.ts';
	import type { ProfileViewer } from '#lib/social/profile-viewer.svelte.ts';
	import { journalCountOf } from '#lib/social/journal.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import LatestJournal from '#lib/components/profile/LatestJournal.svelte';
	import FollowButton from '#lib/components/social/FollowButton.svelte';
	import LikeButton from '#lib/components/social/LikeButton.svelte';
	import MessageButton from '#lib/components/social/MessageButton.svelte';

	let {
		profile,
		viewer,
		counts,
		onfollow
	}: {
		profile: SchemaSocialProfile;
		viewer: ProfileViewer;
		/** Подписчики с поправкой на только что сделанную подписку. */
		counts: { followers: number };
		onfollow?: (delta: 1 | -1) => void;
	} = $props();

	const user = $derived(profile.user);
	const base = $derived(`/u/${user.username}`);
	// В профиле нет отдельных имени и фамилии: заголовок — отображаемое имя, иначе username.
	const name = $derived(displayName(user));
	// Био не повторяет имя: если совпадает, его не выводим.
	const bio = $derived(
		profile.bio && profile.bio.trim() !== name.trim() ? profile.bio.trim() : ''
	);
	const since = $derived(`На сайте с ${fullDate(profile.registered_at)}`);

	// Роль: в контракте профиля её нет, поэтому для себя берём роль из сессии. Для чужих профилей
	// бейдж появится, когда бэкенд отдаст `role` в SocialProfile.
	const ROLE_TITLES: Record<string, string> = { admin: 'Администратор', moderator: 'Модератор' };
	const roleKey = $derived(
		viewer.own ? session.user?.role : (profile as { role?: string }).role
	);
	const roleTitle = $derived(roleKey ? (ROLE_TITLES[roleKey] ?? null) : null);

	// Достижения пока выводим из уже имеющейся активности; отдельного хранилища ачивок нет.
	const achievements = $derived([
		...((journalCountOf(profile) ?? 0) > 0 ? [{ icon: '📚', title: 'В журнале' }] : [])
	]);

	// Полная дата регистрации: «11.10.2026 г.».
	function fullDate(iso: string): string {
		const d = new Date(iso);
		return `${d.getUTCDate().toString().padStart(2, '0')}.${(d.getUTCMonth() + 1).toString().padStart(2, '0')}.${d.getUTCFullYear()} г.`;
	}
</script>

<div class="flex flex-col md:flex-row">
	<!-- Портрет во всю высоту шапки, впритык к краям карточки -->
	<div class="relative aspect-square w-full shrink-0 md:aspect-auto md:w-72 md:self-stretch" title={since}>
		<Avatar {user} size="size-full text-7xl" shape="flush" />
	</div>

	<div class="flex min-w-0 flex-1 flex-col gap-6 p-5 md:flex-row md:items-stretch md:justify-between md:p-6">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2.5">
				<h1 class="min-w-0 truncate text-xl font-semibold sm:text-2xl">{name}</h1>
				{#if roleTitle}
					<span
						class="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/15 px-2.5 py-0.5 text-xs font-medium text-orange-400"
						>{roleTitle}</span
					>
				{/if}
			</div>
			<p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-base-content/50">
				<span title={since}>@{user.username}</span>
				<span aria-hidden="true">·</span>
				<span class="font-medium text-error tabular-nums" title="Рейтинг" aria-label="Рейтинг {profile.reputation.score}">★ {profile.reputation.score}</span>
			</p>

			{#if bio}
				<p class="mt-3 line-clamp-2 max-w-2xl leading-relaxed whitespace-pre-line text-base-content/80">
					{bio}
				</p>
			{/if}

			<div class="mt-3 flex flex-wrap items-center gap-2">
				<!-- Подписчики и подписки одной пилюлей; каждая часть ведёт на свою страницу -->
				<nav
					class="inline-flex items-center gap-2 rounded-full border border-base-content/10 bg-base-content/[0.04] px-3 py-1.5 text-xs text-base-content/80 transition hover:bg-base-content/[0.08]"
					aria-label="Подписки"
				>
					<svg class="size-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<circle cx="9" cy="8" r="3.5" />
						<path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
						<circle cx="17" cy="9" r="2.5" />
						<path d="M16 14.2c2.6.2 5 2.4 5 5.3" />
					</svg>
					<a href="{base}/followers" class="hover:text-primary">
						<b class="tabular-nums">{counts.followers}</b>
						{plural(counts.followers, ['подписчик', 'подписчика', 'подписчиков'])}
					</a>
					<span class="text-base-content/30" aria-hidden="true">·</span>
					<a href="{base}/following" class="hover:text-primary">
						<b class="tabular-nums">{profile.following_count}</b>
						{plural(profile.following_count, ['подписка', 'подписки', 'подписок'])}
					</a>
				</nav>
				<LikeButton
					username={user.username}
					count={profile.likes_count}
					{viewer}
					size="sm"
					variant="pill"
				/>
			</div>

			<!-- Достижения: значки из активности и пунктирные слоты на будущее -->
			<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
				{#each achievements as a (a.title)}
					<span
						class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-base-content/80"
					>
						<span aria-hidden="true">{a.icon}</span>
						{a.title}
					</span>
				{/each}
				<span
					class="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-1 text-xs text-base-content/40"
					>Достижения скоро</span
				>
			</div>
		</div>

		<!-- Правая колонка: постеры журнала сверху, кнопка сразу под ними -->
		<div class="flex w-full flex-col items-start gap-2 md:w-[216px] md:items-end">
			<LatestJournal username={user.username} isOwner={viewer.own} {base} />
			<div class="flex w-full flex-wrap gap-2">
				{#if viewer.own}
					<a href="/settings" class="btn btn-sm btn-outline w-full justify-center">Редактировать профиль</a>
				{:else}
					<FollowButton username={user.username} {viewer} onchange={onfollow} />
					<MessageButton username={user.username} />
				{/if}
			</div>
		</div>
	</div>
</div>
