// Фото профиля: загрузка файла вместо ввода ссылки.
//
// Бэкенд сам пережимает картинку в WebP (длинная сторона 512 px) и квадрат не вырезает — кадрируем
// на своей стороне через object-fit: cover (Avatar.svelte). Загруженное фото лежит по
// относительному адресу /api/v1/auth/avatars/{id}, а пришедшее от Google или GitHub — по
// абсолютному https://; склеивать с базовым адресом нельзя ни то, ни другое (см. avatarSrc).
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaUserView } from '#lib/api/generated/auth.ts';

/** Предел бэкенда: больше — 400 с code: file_too_large. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Что показать в <input type="file" accept>; бэкенд всё равно проверяет сам (not_an_image). */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * Ссылка на аватар как есть: относительная `/api/v1/auth/avatars/{id}` у загруженного файла,
 * абсолютная `https://…` у аватара от провайдера. Обе браузер разрешает сам — относительную от
 * текущего домена (там же, где /api), абсолютную как внешнюю. Приписывать базовый адрес нельзя:
 * внешняя ссылка превратилась бы в несуществующий путь.
 */
export function avatarSrc(url: string | null | undefined): string | null {
	return url?.trim() || null;
}

/** Файл заведомо не пройдёт — скажем это до запроса, а не после 2 МБ по сети. */
export function avatarFileError(file: File): string | null {
	if (file.size > AVATAR_MAX_BYTES) return 'Файл больше 2 МБ. Выберите картинку полегче.';
	if (file.type && !file.type.startsWith('image/')) return 'Это не картинка.';
	return null;
}

/**
 * Загрузить фото: multipart с одним файловым полем. Content-Type с границей ставит сам браузер —
 * openapi-fetch пропускает FormData через сериализатор и своего заголовка не добавляет.
 */
export function uploadAvatar(client: Pick<Api, 'auth'>, file: File): Promise<SchemaUserView> {
	const form = new FormData();
	form.append('file', file);
	return unwrap(
		client.auth.POST('/api/v1/auth/me/avatar', {
			// В контракте тело multipart описано строкой, на деле уходит FormData.
			body: form as unknown as string
		})
	);
}

/** Убрать фото: и загруженный файл, и адрес от провайдера. */
export function deleteAvatar(client: Pick<Api, 'auth'>): Promise<SchemaUserView> {
	return unwrap(client.auth.DELETE('/api/v1/auth/me/avatar'));
}
