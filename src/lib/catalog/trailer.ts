// Трейлер на карточке. Поля в API пока нет — предложено бэкенду (docs/backend-questions.md):
// `trailer_url` в Entity, видеофайл (mp4/webm) с бэкенда или CDN. Как только бэкенд начнёт его
// отдавать, блок с трейлером включится сам; после pnpm api:types приведение типа можно убрать.
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';

/** У книг трейлеров нет — у них остаётся только обложка. */
const WITH_TRAILER: readonly SchemaEntityKind[] = ['movie', 'series', 'game'];

/** Адрес трейлера: http(s):// или путь этого сайта (/media/...); иначе null. */
export function trailerUrl(entity: { kind: SchemaEntityKind }): string | null {
	if (!WITH_TRAILER.includes(entity.kind)) return null;
	const url = (entity as { trailer_url?: unknown }).trailer_url;
	if (typeof url !== 'string') return null;
	return /^https?:\/\//.test(url) || /^\/(?!\/)/.test(url) ? url : null;
}
