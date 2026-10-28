import type { SchemaCollection, SchemaCollectionDetail } from '#lib/api/generated/social.ts';
import { refHref } from '#lib/catalog/kinds.ts';

/**
 * Адрес страницы особой коллекции — единственное место, где он собирается:
 * /collections/{slug}, если коллекция особая и slug есть, иначе /collections/{id}. От него строятся
 * canonical, og:url, JSON-LD, sitemap и ссылки в карточках.
 */
export function buildFeaturedUrl(
	collection: Pick<SchemaCollection, 'id' | 'slug' | 'is_featured'>
): string {
	const slug = collection.is_featured ? collection.slug : null;
	return `/collections/${encodeURIComponent(slug || collection.id)}`;
}

/** <title> без суффикса сайта: «{title} — топ фильмов». */
export function featuredTitle(collection: SchemaCollectionDetail): string {
	return `${collection.title} — топ фильмов`;
}

/** Описание: из description, иначе из первых названий. */
export function featuredDescription(collection: SchemaCollectionDetail): string {
	const own = collection.description?.trim();
	if (own) return own.length > 300 ? `${own.slice(0, 297)}…` : own;
	const names = collection.items.slice(0, 5).map((i) => i.entity.title);
	if (!names.length) return `${collection.title} — подборка редакции Кассандра.`;
	const more = collection.items.length > names.length ? ' и другие' : '';
	return `${collection.title}: ${names.join(', ')}${more}. Подборка редакции Кассандра.`;
}

/** JSON-LD: ItemList произведений + BreadcrumbList. `origin` — https://host. */
export function featuredJsonLd(collection: SchemaCollectionDetail, origin: string): object[] {
	const url = origin + buildFeaturedUrl(collection);
	// Позиция — настоящее место в рейтинге (1 — лучший), независимо от порядка показа.
	const elements = collection.items.flatMap((item, i) => {
		const href = refHref(item.entity);
		return href ? [{ rank: i + 1, title: item.entity.title, url: origin + href }] : [];
	});
	return [
		{
			'@context': 'https://schema.org',
			'@type': 'ItemList',
			name: collection.title,
			url,
			numberOfItems: elements.length,
			itemListElement: elements.map((e) => ({
				'@type': 'ListItem',
				position: e.rank,
				name: e.title,
				url: e.url
			}))
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Главная', item: origin + '/' },
				{ '@type': 'ListItem', position: 2, name: 'Коллекции', item: origin + '/collections' },
				{ '@type': 'ListItem', position: 3, name: collection.title, item: url }
			]
		}
	];
}

/** Безопасная вставка JSON в <script>: без «</script>». */
export function jsonLdScript(data: unknown): string {
	const json = JSON.stringify(data).replace(/</g, '\\u003c');
	return `<script type="application/ld+json">${json}</` + `script>`;
}

/** Жёсткий лимит текста карточки рейтинга: режет по слову и ставит «…». */
export const FEATURED_TEXT_LIMIT = 280;
export function truncate(text: string, limit = FEATURED_TEXT_LIMIT): string {
	const t = text.trim();
	if (t.length <= limit) return t;
	const cut = t.slice(0, limit - 1);
	const space = cut.lastIndexOf(' ');
	return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:—-]+$/, '')}…`;
}

/**
 * «Похожие подборки», пока у бэкенда нет GET /collections/{id}/similar
 * (docs/backend-tasks/collection-saves-similar.md): общие произведения из превью другой подборки
 * с пунктами текущей ×3 + та же тема ×1. При равенстве — порядок API. Сама коллекция исключается.
 */
export function rankSimilar(
	current: Pick<SchemaCollectionDetail, 'id' | 'theme' | 'items'>,
	list: readonly SchemaCollection[],
	limit = 6
): SchemaCollection[] {
	const ids = new Set(current.items.map((i) => i.entity.id));
	return list
		.filter((c) => c.id !== current.id)
		.map((c, index) => {
			const shared = c.preview.filter((e) => ids.has(e.id)).length;
			const theme = current.theme && c.theme === current.theme ? 1 : 0;
			return { c, index, score: shared * 3 + theme };
		})
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.slice(0, limit)
		.map((x) => x.c);
}
