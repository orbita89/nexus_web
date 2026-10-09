// Данные карточки в том виде, в каком их показывает страница: таблица «О фильме» как у
// Кинопоиска, плашка «Режиссёр и актёры», связанные произведения. Всё — из EntityDetail; чего в
// API ещё нет (студии, награды, факты, рекомендации), карточка показывает заглушками, а связей
// нет — раздела нет.
import type {
	SchemaEntityCredit,
	SchemaEntityDetail,
	SchemaEntityKind,
	SchemaEntitySummary,
	SchemaMovieMetadata,
	SchemaPersonRef,
	SchemaSeriesMetadata
} from '#lib/api/generated/catalog.ts';
import { countryName, formatDate, leadRole, metadataFields, roleLabel, yearOf } from './labels.ts';

/** Строка фактов: подпись и значение — текст или ссылки (люди). */
export interface FactRow {
	label: string;
	text?: string;
	links?: { href: string; text: string }[];
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

/** Актёры в порядке титров. */
export function castCredits(credits: SchemaEntityCredit[]): SchemaEntityCredit[] {
	return credits.filter((c) => CAST_ROLES.includes(c.role));
}

/**
 * Плашка под таблицей: главная роль (режиссёр, у книг — автор, у сериалов — создатель) и
 * актёры. Нет ни тех, ни других — null.
 */
export function peopleCard(entity: SchemaEntityDetail): {
	lead: { label: string; credits: SchemaEntityCredit[] } | null;
	cast: SchemaEntityCredit[];
} | null {
	const role = leadRole(entity.kind, entity.credits);
	const lead = role
		? { label: roleLabel(role), credits: entity.credits.filter((c) => c.role === role) }
		: null;
	const cast = castCredits(entity.credits);
	return lead || cast.length ? { lead, cast } : null;
}

// Порядок съёмочной группы в «О фильме», как у Кинопоиска. Роли не из списка — после них.
const CREW_ORDER = [
	'director',
	'creator',
	'showrunner',
	'author',
	'writer',
	'producer',
	'cinematographer',
	'composer',
	'editor',
	'developer',
	'game_designer',
	'illustrator',
	'translator',
	'narrator'
];
const CREW_LABEL: Record<string, string> = { writer: 'Сценарий', composer: 'Композитор' };

/**
 * Таблица «О фильме»: год, страна, съёмочная группа по ролям, дата выхода и поля metadata.
 * Оригинальное название — над описанием. Главная роль и актёры — в плашке под таблицей (peopleCard), теги —
 * над разделом.
 */
export function aboutRows(entity: SchemaEntityDetail): FactRow[] {
	const year = yearOf(entity.release_date);
	const lead = leadRole(entity.kind, entity.credits);
	const crew = new Map<string, SchemaPersonRef[]>();
	for (const credit of entity.credits) {
		if (CAST_ROLES.includes(credit.role) || credit.role === lead) continue;
		const people = crew.get(credit.role) ?? [];
		if (!people.some((p) => p.id === credit.person.id)) people.push(credit.person);
		crew.set(credit.role, people);
	}
	const rank = (role: string) => {
		const i = CREW_ORDER.indexOf(role);
		return i === -1 ? CREW_ORDER.length : i;
	};
	const crewRows = [...crew.entries()]
		.sort(([a], [b]) => rank(a) - rank(b))
		.map(([role, people]) => ({
			label: CREW_LABEL[role] ?? roleLabel(role),
			links: personLinks(people)
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

/**
 * «Рекомендации» подбирает бэкенд: GET /catalog/entities/{slug}/similar. Пока эндпоинта нет — на
 * карточке заглушка и запросов нет (docs/backend-questions.md). Появится — true.
 */
export const RECOMMENDATIONS_API = false;

/** Связанные произведения: приквелы, сиквелы, ремейки — по порядку выхода. */
export interface RelatedWorks {
	prequels?: SchemaEntitySummary[] | null;
	sequels?: SchemaEntitySummary[] | null;
	remakes?: SchemaEntitySummary[] | null;
}

const RELATED_GROUPS = [
	{ key: 'prequels', title: 'Приквелы' },
	{ key: 'sequels', title: 'Сиквелы' },
	{ key: 'remakes', title: 'Ремейки' }
] as const;

/**
 * Непустые группы связанных: [{ title: 'Сиквелы', items }]. Нет связей — []: раздел не рисуется.
 * Поля `related` в контракте ещё нет (docs/backend-questions.md) — читаем его, если бэкенд уже
 * присылает: появится в EntityDetail — раздел на карточке появится сам.
 */
export function relatedGroups(
	entity: object
): { key: keyof RelatedWorks; title: string; items: SchemaEntitySummary[] }[] {
	const related =
		'related' in entity && entity.related && typeof entity.related === 'object'
			? (entity.related as RelatedWorks)
			: {};
	return RELATED_GROUPS.map((g) => ({ ...g, items: related[g.key] ?? [] })).filter(
		(g) => Array.isArray(g.items) && g.items.length > 0
	);
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
