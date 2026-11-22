// Структурированные данные (schema.org, JSON-LD) для карточки: Яндекс и Google показывают по ним
// автора, год и обложку прямо в выдаче. Пока только книги; остальные типы — тем же способом.
import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';

/** Поля книги из metadata (общий тип Metadata — объединение всех типов). */
interface BookMeta {
	isbn?: string | null;
	language?: string | null;
	pages?: number | null;
	publisher?: string | null;
	series?: string | null;
}

/**
 * JSON-LD для карточки. null — тип пока без разметки. `url` — канонический адрес страницы,
 * `origin` — домен (ссылки на авторов абсолютные).
 */
export function entityJsonLd(
	entity: SchemaEntityDetail,
	url: string,
	origin: string
): Record<string, unknown> | null {
	if (entity.kind !== 'book') return null;
	const meta = (entity.metadata ?? {}) as BookMeta;
	const authors = entity.credits
		.filter((c) => c.role === 'author')
		.map((c) => ({
			'@type': 'Person',
			name: c.person.full_name,
			url: `${origin}/people/${c.person.slug}`
		}));
	return clean({
		'@context': 'https://schema.org',
		'@type': 'Book',
		name: entity.title,
		alternateName: entity.original_title || undefined,
		url,
		image: entity.cover_url || undefined,
		description: entity.description || undefined,
		author: authors.length ? authors : undefined,
		datePublished: entity.release_date || undefined,
		isbn: meta.isbn || undefined,
		inLanguage: meta.language || undefined,
		numberOfPages: meta.pages || undefined,
		publisher: meta.publisher ? { '@type': 'Organization', name: meta.publisher } : undefined,
		isPartOf: meta.series ? { '@type': 'BookSeries', name: meta.series } : undefined
	});
}

/** Без пустых полей: undefined в JSON и так не попадёт, но объект короче и тестам проще. */
function clean(o: Record<string, unknown>) {
	return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/**
 * Текст для `<script type="application/ld+json">`: `<` экранируем, чтобы строка из описания
 * («</script>») не закрыла тег.
 */
export function jsonLdScript(data: Record<string, unknown>): string {
	return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
