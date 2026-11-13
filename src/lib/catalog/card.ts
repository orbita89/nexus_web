// Данные карточки в том виде, в каком их показывает страница: таблица «О фильме» как у
// Кинопоиска, плашка «Съёмочная группа и актёры», связанные произведения. Всё — из EntityDetail; нет
// данных (связей, студий, наград) — нет и блока.
import type {
	SchemaBookMetadata,
	SchemaEntityCredit,
	SchemaEntityDetail,
	SchemaEntityKind,
	SchemaGameMetadata,
	SchemaPaintingMetadata,
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
import { kindByApi } from './kinds.ts';
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

/**
 * У фильма на карточке съёмочная группа сокращена до режиссёра: сценаристов, композиторов,
 * монтажёров и прочих ролей не показываем. У остальных типов — без изменений.
 */
export function crewVisible(kind: string, role: string): boolean {
	return kind !== 'movie' || role === 'director' || CAST_ROLES.includes(role);
}

const personLinks = (people: SchemaPersonRef[]) =>
	people.map((p) => ({ href: `/people/${p.slug}`, text: p.full_name }));

/** Оригинальное название, если отличается от русского; иначе null. */
export function originalTitle(entity: { title: string; original_title?: string | null }) {
	return entity.original_title && entity.original_title !== entity.title
		? entity.original_title
		: null;
}

/** «О фильме», «О сериале», «Об игре», «О книге», «О картине». */
export function aboutTitle(kind: SchemaEntityKind): string {
	return {
		movie: 'О фильме',
		series: 'О сериале',
		season: 'О сезоне',
		book: 'О книге',
		game: 'Об игре',
		painting: 'О картине'
	}[kind];
}

/** Страны производства кодами: по ним строим и подписи, и ссылки на выдачу. */
function countryCodes(entity: SchemaEntityDetail): string[] {
	if (entity.kind !== 'movie' && entity.kind !== 'series') return [];
	return (entity.metadata as SchemaMovieMetadata | SchemaSeriesMetadata).countries ?? [];
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
		.filter((g) => !CAST_ROLES.includes(g.role) && crewVisible(entity.kind, g.role))
		.map((g) => ({
			label: CREW_LABEL[g.role] ?? roleLabel(g.role),
			links: personLinks(g.credits.slice(0, ROW_PEOPLE).map((c) => c.person)),
			more: Math.max(0, g.credits.length - ROW_PEOPLE) || undefined
		}));
	// Страны уже в строке «Страна» сверху. У картины отсюда же уходят музей с городом (они стоят
	// блоком «Где хранится» справа) и размер (он под холстом, рядом с самим холстом, где и нужен):
	// в таблице это было второе и третье написание одного и того же.
	const painting = entity.kind === 'painting';
	// Полная дата выхода (или премьеры) уже содержит год: год отдельной строкой — повтор.
	const fullDate = !!entity.release_date && !painting;
	const HIDDEN = painting ? ['Страны', 'Музей', 'Город', 'Размер'] : ['Страны'];
	const fields = metadataFields(entity.kind, entity.metadata)
		.filter((f) => !HIDDEN.includes(f.label))
		.map((f) => ({ label: f.label, text: f.value }));
	const rows: (FactRow | null)[] = [
		// Год — ссылка в свой раздел с фильтром: «что ещё вышло в 2026-м» спрашивают чаще всего.
		year && !fullDate
			? {
					label:
						entity.kind === 'book' ? 'Год издания' : painting ? 'Год создания' : 'Год производства',
					links: [{ href: `/${kindByApi(entity.kind).slug}?year=${year}`, text: year }]
				}
			: null,
		// Страна — ссылка в свой раздел: «что ещё снимали в этой стране» спрашивают так же часто,
		// как «что ещё вышло в этом году».
		countryCodes(entity).length
			? {
					label: countryCodes(entity).length > 1 ? 'Страны' : 'Страна',
					links: countryCodes(entity).map((code) => ({
						href: `/${kindByApi(entity.kind).slug}?country=${code.toUpperCase()}`,
						text: countryName(code)
					}))
				}
			: null,
		...crewRows,
		// У холста премьеры не бывает, а точная дата в каталоге всё равно выдуманная («1 января
		// 1503 г.»): год уже сказан строкой выше и в подписи автора над названием.
		entity.release_date && !painting
			? {
					label: entity.kind === 'game' || entity.kind === 'book' ? 'Дата выхода' : 'Премьера',
					text: formatDate(entity.release_date)
				}
			: null,
		...fields
	];
	return rows.filter((r): r is FactRow => !!r);
}

/** Второстепенные роли — только в полном блоке «О …» внизу, не в компактной плашке у постера. */
const SECONDARY_FACT_LABELS = ['Композитор', 'Оператор', 'Монтаж', 'Монтажёр'];

/** Топ-5 ключевых фактов для компактной плашки у постера. */
export function keyFactRows(entity: SchemaEntityDetail): FactRow[] {
	const rows = aboutRows(entity);
	// Фильмы, сериалы и книги — только основные факты; остальные титры — во вкладке «Создатели».
	const MAIN_FACTS: Partial<Record<string, string[]>> = {
		movie: ['Страна', 'Страны', 'Режиссёр', 'Премьера', 'Длительность'],
		series: ['Страна', 'Страны', 'Режиссёр', 'Премьера', 'Длительность'],
		book: ['Автор', 'Дата выхода', 'Страниц']
	};
	const main = MAIN_FACTS[entity.kind];
	if (main) return rows.filter((r) => main.includes(r.label));
	return rows.filter((r) => !SECONDARY_FACT_LABELS.includes(r.label)).slice(0, 5);
}

/**
 * Есть ли чего ждать: фильм ещё не вышел или сериал продолжается. Только тогда «Следить» стоит
 * отдельной кнопки — у вышедшего фильма новостей не будет, и колокольчик уходит в меню «⋯».
 */
export function worthWatching(entity: SchemaEntityDetail, released: boolean): boolean {
	if (!released) return true;
	if (entity.kind !== 'series') return false;
	const status = (entity.metadata as SchemaSeriesMetadata).status;
	return status === 'ongoing';
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
	SchemaGameMetadata &
	SchemaPaintingMetadata;

/**
 * «Производство и факты»: студии (у фильмов и сериалов — EntityDetail.studios со страницами, у игр —
 * разработчик и издатель, у книг — издательство из metadata), награды, факты. Пустое — null.
 */
/**
 * Музей и город картины — без повторов. В каталоге они часто об одном и том же («Отдел живописи
 * Лувра» и «711-й зал Лувра»), и два бейджа рядом выглядели как ошибка: вложенное название
 * выбрасываем, оставляя более полное.
 */
function museumPlace(places: { name: string }[]): { name: string }[] {
	const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
	return places.filter(
		(place) => !places.some((other) => other !== place && key(other.name).includes(key(place.name)))
	);
}

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
				? // Издателя у книги не показываем: он не нужен в карточке.
					[]
				: entity.kind === 'painting'
					? // У картины «производство» — где она сейчас: музей и его город.
						museumPlace(plain([m.museum, m.city]))
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
					: entity.kind === 'painting'
						? 'Где хранится'
						: 'Студии',
		studios,
		awards,
		triviaTitle:
			entity.kind === 'book' || entity.kind === 'painting'
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
