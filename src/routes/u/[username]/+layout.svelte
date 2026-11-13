<script lang="ts">
	import { session } from '#lib/auth/session.svelte.ts';
	import { journalCountOf } from '#lib/social/journal.ts';
	import { canSeeStats } from '#lib/social/profile.ts';
	import { ProfileViewer } from '#lib/social/profile-viewer.svelte.ts';
	import ProfileHeader from '#lib/components/profile/ProfileHeader.svelte';
	import ProfileTabs, { type ProfileTab } from '#lib/components/profile/ProfileTabs.svelte';
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

	// Заметки видны только владельцу; на сервере сессии нет, поэтому isOwner — после гидрации.
	const isOwner = $derived(session.user?.username === user.username);

	// Счётчик журнала: сервер отдаёт null без токена. Владельцу его дают только в перечитанном
	// с токеном профиле (viewer.profile), поэтому берём число оттуда, когда он пришёл.
	const journal = $derived(journalCountOf(viewer.profile ?? profile));

	// Подписчиков и подписки во вкладки не выносим: на них уже ведут счётчики в шапке.
	// «Журнал» — он же «Отчёт»: отдельного маршрута у отчёта нет.
	const tabs = $derived<ProfileTab[]>([
		{ href: base, title: 'Обзор', n: null },
		{ href: `${base}/journal`, title: 'Журнал', n: journal },
		{ href: `${base}/reviews`, title: 'Рецензии', n: profile.reviews_count },
		{ href: `${base}/threads`, title: 'Темы', n: profile.threads_count },
		{ href: `${base}/collections`, title: 'Коллекции', n: profile.collections_count },
		// Оценки, отметки и комментарии — разделы «Статистики», своих вкладок у них нет.
		...(stats ? [{ href: `${base}/stats`, title: 'Статистика', n: null }] : [])
	]);
</script>

<header class="relative mb-8 overflow-hidden rounded-box bg-base-200 ring-1 ring-base-300">
	<ProfileHeader {profile} {viewer} counts={{ followers }} onfollow={onFollow} />
	<ProfileTabs username={user.username} {tabs} {isOwner} />
</header>

{@render children()}
