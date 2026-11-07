// Сезоны и серии сериала. Сезон — сущность со своим slug (`arcane-season-2`), поэтому оценки,
// рецензии и коллекции у него общие с остальным каталогом; серия — только карточка в ленте:
// ни страницы, ни рецензий у неё нет.
//
// Видео у нас нет, поэтому «просмотрено», прогресса и «продолжить смотреть» здесь не будет —
// карточка серии показывает название, дату и длительность.
import type { SchemaEpisode, SchemaSeasonSummary } from '#lib/api/generated/catalog.ts';
import { count, formatDate, formatRuntime, yearOf } from './labels.ts';

const EPISODES = ['серия', 'серии', 'серий'] as const;

/** «6 серий» — подпись на таблетке сезона и в заголовке ленты. */
export function episodesCount(n: number): string {
	return count(n, EPISODES);
}

/** «Сезон 2», спецвыпуски (0) — своим словом: номером их не назовёшь. */
export function seasonTitle(season: { number?: number | null; title?: string | null }): string {
	if (season.title) return season.title;
	return season.number ? `Сезон ${season.number}` : 'Спецвыпуски';
}

/** Короткая подпись на таблетке: «2 сезон», «Спецвыпуски». */
export function seasonTab(season: SchemaSeasonSummary): string {
	return season.number ? `${season.number} сезон` : 'Спецвыпуски';
}

/**
 * Адрес сезона — внутри сериала, а не отдельным разделом: /series/arcane/season-2. Сезоны в
 * выдачу каталога не попадают, своего раздела у них нет, и ссылку на них строим от сериала.
 */
export function seasonHref(seriesSlug: string, number: number | null | undefined): string {
	return `/series/${seriesSlug}/season-${number ?? 0}`;
}

/** Серия вышла? Невышедшие приходят вместе с остальными и рисуются приглушённо. */
export function episodeReleased(episode: SchemaEpisode, today: string): boolean {
	return !episode.air_date || episode.air_date <= today;
}

/** «1. Тяжёлые времена»; без названия — «Серия 1». */
export function episodeTitle(episode: SchemaEpisode): string {
	return episode.title ? `${episode.number}. ${episode.title}` : `Серия ${episode.number}`;
}

/** Подпись под названием серии: дата выхода и длительность, что есть. */
export function episodeMeta(episode: SchemaEpisode): string[] {
	return [
		episode.air_date ? formatDate(episode.air_date) : null,
		episode.runtime_minutes ? formatRuntime(episode.runtime_minutes) : null
	].filter((part): part is string => !!part);
}

/**
 * Пропорции кадра до загрузки файла. Размеры есть не у всех серий (бэкенд дозаливает их
 * отдельным проходом), без них держим 16:9 — итоговая пропорция кадра всё равно такая.
 */
export function stillRatio(episode: SchemaEpisode): string {
	const { still_width: w, still_height: h } = episode;
	return w && h ? `${w} / ${h}` : '16 / 9';
}

/** Год сезона для заголовка: «Сезон 2 (2024)». */
export function seasonYear(season: { premiere_date?: string | null }): string | null {
	return yearOf(season.premiere_date);
}
