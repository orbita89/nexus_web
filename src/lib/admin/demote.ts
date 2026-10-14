// Перенос фильмов с сайта в холодный архив (POST /admin/archive/demote): до 100 за раз. Из
// каталога пропадает всё, кроме «скелета»; вернуть можно, но только с названием, датой и постером.
import { ApiError, errorMessage } from '#lib/api/errors.ts';
import type { SchemaDemoteResult, SchemaDemoteSkipReason } from '#lib/api/generated/catalog.ts';

export const DEMOTE_LIMIT = 100;

export const DEMOTE_WARNING =
	'Описание, титры, жанры и теги пропадут. При возврате из архива фильм вернётся только с названием, датой выхода и постером.';

const REASONS: Record<SchemaDemoteSkipReason, string> = {
	in_use: 'есть данные пользователей',
	not_found: 'уже в архиве или нет на сайте',
	no_tmdb: 'не из TMDB'
};

/** Причина пропуска для людей; новая причина — как есть. */
export function skipReason(reason: string): string {
	return (REASONS as Record<string, string>)[reason] ?? reason;
}

/** «Перенесено 3 из 5»: итог одной строкой. */
export function demoteSummary(result: SchemaDemoteResult, asked: number): string {
	const moved = result.archived.length;
	if (moved === asked) return asked === 1 ? 'Фильм перенесён в архив.' : `Перенесено: ${moved}.`;
	return `Перенесено ${moved} из ${asked}.`;
}

/** Ошибка переноса → текст. 409 — архив пересобирается, ничего не перенесено. */
export function demoteError(e: unknown): string {
	if (e instanceof ApiError && e.status === 409) {
		return 'Архив сейчас пересобирается, повторите позже.';
	}
	if (e instanceof ApiError && e.status === 503) return 'Архив временно недоступен.';
	return errorMessage(e);
}
