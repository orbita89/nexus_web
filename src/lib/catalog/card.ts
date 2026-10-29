// Данные карточки в том виде, в каком их показывает страница: таблица «О фильме» как у
// Кинопоиска, плашка «Съёмочная группа и актёры», связанные произведения. Всё — из EntityDetail; нет
// данных (связей, студий, наград) — нет и блока.
import type {
	SchemaBookMetadata,
	SchemaEntityCredit,
	SchemaEntityDetail,
	SchemaEntityKind,
	SchemaGameMetadata,
	SchemaMovieMetadata,
	SchemaPersonRef,
	SchemaRelatedWork,
	SchemaSeriesMetadata
} from '#lib/api/generated/catalog.ts';
import {
	countryName,
	formatDate,
	metadataFields,
	roleGroupTitle,
	roleLabel,
	roleRank,
	yearOf
} from './labels.ts';
import { studioHref } from './studios.ts';

/** Строка фактов: подпись и значение — текст или ссылки (люди). */
export interface FactRow {
	label: string;
	text?: string;
	links?: { href: string; text: string }[];
	/** Сколько людей не влезло в строку — «и ещё N» ссылкой на полные титры. */
	more?: number;
}

/** Актёры (и озвучка — у игр и мультфильмов это и есть «роли»). */
const CAST_ROLES = ['actor', 'voice_actor'];

const personLinks = (people: SchemaPersonRef[]) =>
	people.map((p) => ({ href: `/people/${p.slug}`, text: p.full_name }));

/** Оригинальное название, если отличается от русского; иначе null. */
export function originalTitle(entity: { title: string; original_title?: string | null }) {
	return entity.original_title && entity.original_title !== entity.title
		? entity.original_title
		: null;
}

/** «О фильме», «О сериале», «Об игре», «О книге». */
export function aboutTitle(kind: SchemaEntityKind): string {
	return { movie: 'О фильме', series: 'О сериале', book: 'О книге', game: 'Об игре' }[kind];
}

function countries(entity: SchemaEntityDetail): string | null {
	if (entity.kind !== 'movie' && entity.kind !== 'series') return null;
	const list = (entity.metadata as SchemaMovieMetadata | SchemaSeriesMetadata).countries;
	return list?.length ? list.map(countryName).join(', ') : null;
}

export interface CreditGroup {
	role: string;
	/** «Режиссёры», «В ролях»; неизвестная роль — как есть. */
	title: string;
	credits: SchemaEntityCredit[];
	/** Сколько показать сразу; остальные — по «Показать всех». */
	shown: number;
}

/** Сразу видно: актёров — 12, остальных ролей — 6. */
const SHOWN = { cast: 12, crew: 6 };

/**
 * Титры по группам в порядке ROLE_GROUPS, неизвестные роли — после, в порядке появления.
 * Внутри — как прислал бэкенд (по position). Человек в нескольких ролях — в каждой группе, но в
 * одной группе один раз. Нет титров — [].
 */
export function creditGroups(credits: SchemaEntityCredit[]): CreditGroup[] {
	const byRole = new Map<string, SchemaEntityCredit[]>();
	for (const credit of credits) {
		const list = byRole.get(credit.role) ?? [];
		if (!list.some((c) => c.person.id === credit.person.id)) list.push(credit);
		byRole.set(credit.role, list);
	}
	return [...byRole.entries()]
		.toSorted(([a], [b]) => roleRank(a) - roleRank(b))
		.map(([role, list]) => ({
			role,
			title: roleGroupTitle(role),
			credits: list,
			shown: CAST_ROLES.includes(role) ? SHOWN.cast : SHOWN.crew
		}));
}

/** В строке таблицы «О фильме» — первые трое, остальные — в полных титрах ниже. */
const ROW_PEOPLE = 3;
const CREW_LABEL: Record<string, string> = { writer: 'Сценарий', editor: 'Монтаж' };

/**
 * Таблица «О фильме»: год, страна, съёмочная группа по ролям (первые трое, «и ещё N»), дата
 * выхода и поля metadata. Оригинальное название — над описанием. Полные титры с актёрами — в
 * плашке под таблицей (creditGroups), теги — над разделом.
 */
export function aboutRows(entity: SchemaEntityDetail): FactRow[] {
	const year = yearOf(entity.release_date);
	const crewRows = creditGroups(entity.credits)
		.filter((g) => !CAST_ROLES.includes(g.role))
		.map((g) => ({
			label: CREW_LABEL[g.role] ?? roleLabel(g.role),
			links: personLinks(g.credits.slice(0, ROW_PEOPLE).map((c) => c.person)),
			more: Math.max(0, g.credits.length - ROW_PEOPLE) || undefined
		}));
	// Страны уже в строке «Страна» сверху.
	const fields = metadataFields(entity.kind, entity.metadata)
		.filter((f) => f.label !== 'Страны')
		.map((f) => ({ label: f.label, text: f.value }));
	const rows: (FactRow | null)[] = [
		year
			? { label: entity.kind === 'book' ? 'Год издания' : 'Год производства', text: year }
			: null,
		countries(entity) ? { label: 'Страна', text: countries(entity)! } : null,
		...crewRows,
		entity.release_date
			? {
					label: entity.kind === 'game' || entity.kind === 'book' ? 'Дата выхода' : 'Премьера',
					text: formatDate(entity.release_date)
				}
			: null,
		...fields
	];
	return rows.filter((r): r is FactRow => !!r);
}

/** Связанные произведения: приквелы, сиквелы, ремейки — по порядку выхода. */
export interface Production {
	studiosTitle: string;
	/** У фильмов и сериалов — ссылки на страницы студий; у игр и книг — просто названия. */
	studios: { name: string; href?: string; logoUrl?: string | null }[];
	/** Сначала победы, затем номинации; внутри — по году. */
	awards: { title: string; year: number | null; won: boolean }[];
	triviaTitle: string;
	trivia: string[];
}

/** Metadata любого типа работы: поля читаем по наличию. */
export type AnyMetadata = SchemaMovieMetadata &
	SchemaSeriesMetadata &
	SchemaBookMetadata &
	SchemaGameMetadata;

/**
 * «Производство и факты»: студии (у фильмов и сериалов — EntityDetail.studios со страницами, у игр —
 * разработчик и издатель, у книг — издательство из metadata), награды, факты. Пустое — null.
 */
export function productionOf(
	entity: Pick<SchemaEntityDetail, 'kind' | 'metadata' | 'studios'>
): Production | null {
	const m = entity.metadata as AnyMetadata;
	const plain = (names: (string | null | undefined)[]) =>
		[...new Set(names.filter((s): s is string => !!s))].map((name) => ({ name }));
	const studios =
		entity.kind === 'game'
			? plain([m.developer, m.publisher])
			: entity.kind === 'book'
				? plain([m.publisher])
				: entity.studios.map((s) => ({
						name: s.name,
						href: studioHref(s.slug),
						logoUrl: s.logo_url
					}));
	const awards = (m.awards ?? [])
		.map((a) => ({ title: a.title, year: a.year ?? null, won: a.won ?? false }))
		.toSorted((a, b) => Number(b.won) - Number(a.won) || (a.year ?? 0) - (b.year ?? 0));
	const trivia = m.trivia ?? [];
	if (!studios.length && !awards.length && !trivia.length) return null;
	return {
		studiosTitle:
			entity.kind === 'book'
				? 'Издательство'
				: entity.kind === 'game'
					? 'Разработка и издание'
					: 'Студии',
		studios,
		awards,
		triviaTitle:
			entity.kind === 'book'
				? 'Интересные факты'
				: entity.kind === 'game'
					? 'Факты о разработке'
					: 'Факты о съёмках',
		trivia
	};
}

/** Подпись связи у постера в карусели «Связанные». */
export type RelatedLabel = 'Приквел' | 'Сиквел' | 'Ремейк' | 'Оригинал';

/**
 * Карусель «Связанные»: приквелы, сиквелы и ремейки одной полосой, как прислал бэкенд
 * (хронологически, без даты — в конце). У каждого — подпись связи; ремейк, вышедший раньше
 * текущего произведения, — «Оригинал». Нет связей — []: раздел не рисуется.
 */
export function relatedWorks(
	entity: Pick<SchemaEntityDetail, 'related' | 'release_date'>
): { item: SchemaRelatedWork; label: RelatedLabel }[] {
	return entity.related.map((item) => ({ item, label: relatedLabel(item, entity.release_date) }));
}

function relatedLabel(item: SchemaRelatedWork, releaseDate?: string | null): RelatedLabel {
	switch (item.relation) {
		case 'prequel':
			return 'Приквел';
		case 'sequel':
			return 'Сиквел';
		case 'remake':
			return item.release_date && releaseDate && item.release_date < releaseDate
				? 'Оригинал'
				: 'Ремейк';
	}
}

/**
 * Вышло ли произведение: оценки открываются после премьеры. Без даты считаем вышедшим — у
 * старых книг и игр в каталоге даты часто нет. today — 'YYYY-MM-DD' (для тестов).
 */
export function isReleased(
	releaseDate: string | null | undefined,
	today = new Date().toISOString().slice(0, 10)
): boolean {
	return !releaseDate || releaseDate <= today;
}
