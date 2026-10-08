<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import ReindexPanel from '#lib/components/admin/ReindexPanel.svelte';

	// Индексация: у каждой сущности сайта два «индекса» — поисковый (Meilisearch) и статические
	// страницы (HTML + __data.json, nginx отдаёт с диска). Правки в админке обновляют оба сами;
	// здесь — полная перестройка. Новая сущность — ещё один ReindexPanel со своим эндпоинтом.

	const reindexEntities = async (force: boolean) =>
		(await unwrap(
			api.catalog.POST('/api/v1/catalog/admin/search/reindex/stream', {
				params: { query: force ? { force: true } : {} },
				parseAs: 'stream'
			})
		))!;
</script>

<svelte:head><title>Индексация — Админка — Nexus</title></svelte:head>

<h1 class="mb-2 text-3xl font-black">Индексация</h1>
<p class="mb-6 max-w-3xl text-sm text-base-content/60">
	У каждого раздела два индекса: <strong>поиск</strong> (Meilisearch) и
	<strong>статические страницы</strong> — готовые HTML и данные, которые сайт отдаёт без рендера.
	Правки в админке обновляют оба сами. Полная переиндексация нужна, если данные загружали в обход
	API (например, <code>make seed</code>) или поиск и страницы разошлись с базой. Страницы
	пересобираются в фоне на фронтенд-сервере: ход и итог — в его логе; в режиме разработки шаг не
	нужен — страницы рендерятся на каждый запрос.
</p>

<div class="flex max-w-3xl flex-col gap-4">
	<ReindexPanel
		id="entities"
		title="Произведения"
		what={[
			'Поиск: новый индекс из базы, переключение без простоя, предыдущая версия сохраняется',
			'Статические страницы карточек: /films, /series, /books, /games — все, в фоне'
		]}
		start={reindexEntities}
	/>
	<ReindexPanel
		id="people"
		title="Люди"
		what={[
			'Поиск по людям и статические страницы /people — появятся, когда бэкенд начнёт их индексировать',
			'Пока страницы людей рендерятся на каждый запрос, а правки в них видны сразу'
		]}
	/>
</div>
