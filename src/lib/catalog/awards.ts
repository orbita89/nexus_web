// Награды: премии (/awards), церемонии (/awards/oscar/2024) и строчки наград на карточке
// работы и в профиле человека. Данные неровные — у большинства церемоний нет номера, даты и
// места, категория часто одна, номинаций людей почти нет: всё необязательное показываем только
// когда оно есть, пустых блоков не рисуем.
import type {
	SchemaAwardEditionBrief,
	SchemaAwardEditionDetail,
	SchemaAwardListItem,
	SchemaEntityAward,
	SchemaEntityKind,
	SchemaNomination
} from '#lib/api/generated/catalog.ts';
import { entityHref, KINDS } from './kinds.ts';

/** Вкладки раздела: «Все» и типы работ, по которым премии разделены (`kinds` премии). */
export const AWARD_TABS = [
	{ value: undefined, title: 'Все' },
	...KINDS.map((k) => ({ value: k.kind as SchemaEntityKind, title: k.title }))
] as const;

/** Тип работ из адреса (?kind=movie); мусор — все премии. */
export function readAwardKind(raw: string | undefined): SchemaEntityKind | undefined {
	return AWARD_TABS.find((t) => t.value && t.value === raw)?.value;
}

/** Годы премии на плитке: «1929–2024», «2024» или ничего, если церемоний нет. */
export function yearsLabel(award: Pick<SchemaAwardListItem, 'first_year' | 'latest_year'>) {
	const { first_year: from, latest_year: to } = award;
	if (from && to) return from === to ? String(from) : `${from}–${to}`;
	return from ? String(from) : to ? String(to) : null;
}

/** «за 2023 год» — только когда год работ отличается от года церемонии. */
export function seasonLabel(
	edition: Pick<SchemaAwardEditionBrief, 'year' | 'season_year'>
): string | null {
	return edition.season_year && edition.season_year !== edition.year
		? `за ${edition.season_year} год`
		: null;
}

/** «96-я церемония» — если номер известен. */
export const numberLabel = (number: number | null | undefined) =>
	number ? `${number}-я церемония` : null;

/** Дата церемонии «10 марта 2024» — если известна. */
export function heldLabel(held: string | null | undefined): string | null {
	if (!held) return null;
	const date = new Date(held);
	return Number.isNaN(date.getTime())
		? null
		: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Подзаголовок церемонии: номер, дата и место — всё, что есть. */
export function editionMeta(
	edition: Pick<SchemaAwardEditionDetail, 'number' | 'held_on' | 'place' | 'year' | 'season_year'>
): string[] {
	return [
		numberLabel(edition.number),
		heldLabel(edition.held_on),
		edition.place,
		seasonLabel(edition)
	].filter((part): part is string => !!part);
}

/** Кого номинировали: человек, работа или просто строка, если в каталоге этого нет. */
export function nomineeName(nomination: SchemaNomination): string {
	return (
		nomination.person?.full_name ?? nomination.entity?.title ?? nomination.name ?? 'Без названия'
	);
}

/** Ссылка на номинанта: человек важнее работы (работа уйдёт в подпись). null — ссылки нет. */
export function nomineeHref(nomination: SchemaNomination): string | null {
	if (nomination.person) return `/people/${nomination.person.slug}`;
	if (nomination.entity) return entityHref(nomination.entity);
	return null;
}

/**
 * Подпись под номинантом: у человека — работа и роль («Оппенгеймер · режиссёр»), у работы —
 * только роль. Нечего сказать — null, строку не рисуем.
 */
export function nomineeNote(nomination: SchemaNomination): string | null {
	const parts = [
		nomination.person && nomination.entity ? nomination.entity.title : null,
		nomination.role
	];
	const note = parts.filter(Boolean).join(' · ');
	return note || null;
}

/** Название категории в этот год: премии переименовывают их, в номинации лежит старое. */
export const categoryTitle = (category: { title: string }, nomination?: SchemaNomination) =>
	nomination?.title_override || category.title;

export interface AwardYearGroup {
	year: number;
	items: SchemaEntityAward[];
}

export interface AwardGroup {
	award: SchemaEntityAward['award'];
	/** Есть хотя бы одна победа — такую премию показываем выше номинаций. */
	won: boolean;
	years: AwardYearGroup[];
}

/**
 * Награды работы или человека для блока на карточке: по премиям, внутри — по годам (новые
 * сверху). Бэкенд уже отдаёт победы первыми, но группировка нужна фронту: иначе «Оскар» 2024
 * и 2015 висят в списке порознь.
 */
export function groupAwards(awards: readonly SchemaEntityAward[]): AwardGroup[] {
	const groups = new Map<string, AwardGroup>();
	for (const item of awards) {
		let group = groups.get(item.award.slug);
		if (!group) {
			group = { award: item.award, won: false, years: [] };
			groups.set(item.award.slug, group);
		}
		group.won ||= item.won;
		let year = group.years.find((y) => y.year === item.year);
		if (!year) {
			year = { year: item.year, items: [] };
			group.years.push(year);
		}
		year.items.push(item);
	}
	const list = [...groups.values()];
	for (const group of list) {
		group.years.sort((a, b) => b.year - a.year);
		for (const year of group.years) year.items.sort((a, b) => Number(b.won) - Number(a.won));
	}
	// Премии с победами выше, дальше — по свежести последней церемонии.
	return list.sort(
		(a, b) => Number(b.won) - Number(a.won) || (b.years[0]?.year ?? 0) - (a.years[0]?.year ?? 0)
	);
}

/**
 * Раздел каталога с работами премии: по её первому типу работ. У The Game Awards это /games,
 * а не /films. Тип неизвестен — фильмы.
 */
export function awardCatalogHref(kinds: readonly string[], slug: string, year?: number): string {
	const kind = KINDS.find((k) => k.kind === kinds?.[0]) ?? KINDS[0];
	return `/${kind.slug}?award=${slug}${year ? `&award_year=${year}` : ''}`;
}

/**
 * Превью года без повторов: в `top` одна работа приходит столько раз, сколько у неё побед
 * («Золотой глобус» — драма и комедия в одной категории), а в ленте нужен один постер.
 */
export function uniqueTop<T extends { id: string }>(top: readonly T[], limit = 4): T[] {
	const seen = new Set<string>();
	const out: T[] = [];
	for (const item of top) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		out.push(item);
		if (out.length === limit) break;
	}
	return out;
}

/** Адрес церемонии. */
export const editionHref = (slug: string, year: number) => `/awards/${slug}/${year}`;

/** Сколько побед и номинаций — подпись «2 награды, 7 номинаций». */
export function awardsTally(awards: readonly SchemaEntityAward[]) {
	const wins = awards.filter((a) => a.won).length;
	return { wins, nominations: awards.length - wins };
}
