// Кто может читать книгу: решает кнопка «Читать» на статической карточке (после гидрации — роль
// известна только в браузере). Защита — на сервере (401/403), здесь только подсказка.
import type { SchemaRole } from '#lib/api/generated/auth.ts';

/** Роли, которым открыты закрытые книги. */
export const READER_ROLES: readonly SchemaRole[] = ['vip', 'admin'];

/**
 * - `read` — открыть читалку;
 * - `login` — гость: «Войдите, чтобы читать»;
 * - `invite` — вошёл, но роль не та: «Доступ по приглашению»;
 * - `wait` — сессия ещё не восстановлена (не мигать «Войдите» у вошедшего).
 */
export type ReadAccess = 'read' | 'login' | 'invite' | 'wait';

export function readAccess(
	publicRead: boolean,
	status: 'loading' | 'guest' | 'authed',
	role: SchemaRole | null | undefined
): ReadAccess {
	if (publicRead) return 'read';
	if (status === 'loading') return 'wait';
	if (status === 'guest') return 'login';
	return role && READER_ROLES.includes(role) ? 'read' : 'invite';
}

/** Сведения о файле из metadata карточки: есть ли он, публичный ли, размер. */
export function bookFile(metadata: unknown): {
	has: boolean;
	publicRead: boolean;
	size: number | null;
} {
	const m = (metadata ?? {}) as { file?: { size?: number | null } | null; public_read?: boolean };
	return { has: !!m.file, publicRead: m.public_read === true, size: m.file?.size ?? null };
}

/** Адрес файла книги в API. */
export const epubUrl = (slug: string) => `/api/v1/catalog/books/${encodeURIComponent(slug)}/epub`;
