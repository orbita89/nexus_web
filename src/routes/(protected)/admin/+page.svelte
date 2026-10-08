<script lang="ts">
	const cards = [
		{
			href: '/admin/entities',
			title: 'Произведения',
			text: 'Фильмы, сериалы, книги и игры: поля, обложки, трейлеры, теги, участники.'
		},
		{ href: '/admin/people', title: 'Люди', text: 'Актёры, режиссёры, авторы: фото и биографии.' },
		{ href: '/admin/tags', title: 'Теги', text: 'Жанры и темы, общие для всех разделов.' },
		{ href: '/admin/users', title: 'Пользователи', text: 'Роли и блокировки.' },
		{
			href: '/admin/index',
			title: 'Индексация',
			text: 'Поиск и статические страницы: полная перестройка по разделам.'
		}
	];
</script>

<svelte:head><title>Админка — Nexus</title></svelte:head>

<h1 class="mb-6 text-3xl font-black">Админка</h1>

<ul class="mb-8 grid gap-3 sm:grid-cols-2">
	{#each cards as card (card.href)}
		<li>
			<a
				href={card.href}
				class="block h-full rounded-box bg-base-200 p-4 ring-1 ring-base-300 transition hover:ring-primary"
			>
				<span class="block text-lg font-semibold">{card.title}</span>
				<span class="mt-1 block text-sm text-base-content/60">{card.text}</span>
			</a>
		</li>
	{/each}
</ul>
