import { publicApi } from '#lib/api/client.ts';
import { getFeaturedCollections } from '#lib/social/collections.ts';
import { buildFeaturedUrl } from '#lib/social/featured.ts';
import type { RequestHandler } from './$types';

const escapeXml = (s: string) =>
	s.replace(
		/[<>&'"]/g,
		(c) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[c]};`
	);

export const GET: RequestHandler = async ({ fetch, url }) => {
	const featured = await getFeaturedCollections(publicApi(fetch, url)).catch(() => []);
	const urls = [
		`<url><loc>${escapeXml(`${url.origin}/`)}</loc></url>`,
		`<url><loc>${escapeXml(`${url.origin}/collections/featured`)}</loc></url>`,
		...featured.map(
			(c) =>
				`<url><loc>${escapeXml(`${url.origin}${buildFeaturedUrl(c)}`)}</loc><lastmod>${escapeXml(c.updated_at)}</lastmod></url>`
		)
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
