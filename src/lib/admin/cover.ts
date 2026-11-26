// Замена обложки книги файлом (POST /admin/entities/{id}/cover).
//
// Бэкенд не перекодирует: файл ложится на место старого по тому же пути
// (/covers/books/<пачка>/<номер>.avif), поэтому принимается только AVIF до 10 МБ.
// Адрес обложки после замены прежний — браузер держит старую картинку в кэше (сутки), так что
// превью в админке показываем с меткой времени (coverPreview).
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';

/** Предел бэкенда: больше — 400 с code: file_too_large. */
export const COVER_MAX_BYTES = 10 * 1024 * 1024;

/** Для <input type="file" accept>; бэкенд проверяет сам (not_avif). */
export const COVER_ACCEPT = '.avif,image/avif';

/** Файл заведомо не пройдёт — скажем до запроса. */
export function coverFileError(file: File): string | null {
	const avif = file.type === 'image/avif' || /\.avif$/i.test(file.name);
	if (!avif)
		return 'Нужен файл AVIF (.avif). Другие форматы не принимаются: файл не перекодируется.';
	if (file.size > COVER_MAX_BYTES) return 'Файл больше 10 МБ.';
	if (file.size === 0) return 'Файл пустой.';
	return null;
}

/** Адрес для превью в обход кэша браузера: тот же файл, новая метка. */
export function coverPreview(url: string | null | undefined, version: number): string | null {
	const clean = url?.trim();
	if (!clean) return null;
	return version ? `${clean}${clean.includes('?') ? '&' : '?'}t=${version}` : clean;
}

/** Загрузить обложку: multipart с одним файловым полем, ответ — карточка книги. */
export function uploadCover(
	client: Pick<Api, 'catalog'>,
	id: string,
	file: File
): Promise<SchemaEntityDetail> {
	const form = new FormData();
	form.append('file', file);
	return unwrap(
		client.catalog.POST('/api/v1/catalog/admin/entities/{id}/cover', {
			params: { path: { id } },
			// В контракте тело multipart описано строкой, на деле уходит FormData.
			body: form as unknown as string
		})
	);
}
