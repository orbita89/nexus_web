// Подписи для данных каталога: роли, поля metadata по типам, годы и даты. Бэкенд отдаёт коды
// (`actor`, `ps5`, `US`, `ongoing`) — здесь они превращаются в русский текст.
import type {
	SchemaBookMetadata,
	SchemaEntityKind,
	SchemaGameMetadata,
	SchemaMetadata,
	SchemaMovieMetadata,
	SchemaSeriesMetadata
} from '#lib/api/generated/catalog.ts';

/** 1 сезон, 2 сезона, 5 сезонов. */
export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return one;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
}

/** «5 сезонов»: число с пробелами по разрядам и слово в нужной форме. */
export function count(n: number, forms: readonly [string, string, string]): string {
	return `${n.toLocaleString('ru-RU')} ${plural(n, forms)}`;
}

const ROLES: Record<string, string> = {
	actor: 'Актёр',
	voice_actor: 'Озвучка',
	director: 'Режиссёр',
	writer: 'Сценарист',
	author: 'Автор',
	composer: 'Композитор',
	creator: 'Создатель',
	developer: 'Разработчик',
	producer: 'Продюсер',
	cinematographer: 'Оператор',
	editor: 'Монтаж',
	translator: 'Переводчик',
	illustrator: 'Иллюстратор',
	narrator: 'Рассказчик',
	showrunner: 'Шоураннер',
	game_designer: 'Геймдизайнер'
};

/** actor → «Актёр»; неизвестная роль — как есть, но читаемо: art_director → «Art director». */
export function roleLabel(role: string): string {
	if (ROLES[role]) return ROLES[role];
	const text = role.replace(/_/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 155 → «2 ч 35 мин», 120 → «2 ч», 45 → «45 мин». */
export function formatRuntime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} мин`;
	return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

// Intl знает почти все страны, но US называет «Соединенные Штаты», а устаревший SU — «Россия».
const COUNTRIES: Record<string, string> = { US: 'США', SU: 'СССР' };
const regionNames = new Intl.DisplayNames(['ru'], { type: 'region', fallback: 'code' });

/** ISO 3166-1 alpha-2 → название: US → «США», PL → «Польша». */
export function countryName(code: string): string {
	const upper = code.toUpperCase();
	if (COUNTRIES[upper]) return COUNTRIES[upper];
	try {
		return regionNames.of(upper) ?? upper;
	} catch {
		return upper;
	}
}

const PLATFORMS: Record<string, string> = {
	pc: 'PC',
	mac: 'macOS',
	linux: 'Linux',
	ps3: 'PlayStation 3',
	ps4: 'PlayStation 4',
	ps5: 'PlayStation 5',
	'xbox-360': 'Xbox 360',
	'xbox-one': 'Xbox One',
	'xbox-series': 'Xbox Series X|S',
	switch: 'Nintendo Switch',
	ios: 'iOS',
	android: 'Android'
};

/** ps5 → «PlayStation 5»; неизвестная платформа — как есть. */
export function platformLabel(code: string): string {
	return PLATFORMS[code] ?? code;
}

const SERIES_STATUS: Record<string, string> = {
	ongoing: 'Идёт',
	ended: 'Завершён',
	canceled: 'Закрыт'
};

export interface Field {
	label: string;
	value: string;
}

const list = (items: readonly string[] | null | undefined, label: (s: string) => string) =>
	items?.length ? items.map(label).join(', ') : null;

/**
 * Поля metadata для карточки — подпись и значение, в порядке показа. Пустые поля пропускаются.
 * Какие поля у какого типа — в nexus_project/documents/modules/catalog.md.
 */
export function metadataFields(kind: SchemaEntityKind, metadata: SchemaMetadata): Field[] {
	const rows: [string, string | null | undefined][] = [];
	switch (kind) {
		case 'movie': {
			const m = metadata as SchemaMovieMetadata;
			rows.push(
				['Длительность', m.runtime_min ? formatRuntime(m.runtime_min) : null],
				['Страны', list(m.countries, countryName)],
				['Возрастной рейтинг', m.age_rating]
			);
			break;
		}
		case 'series': {
			const m = metadata as SchemaSeriesMetadata;
			rows.push(
				['Сезоны', m.seasons ? String(m.seasons) : null],
				['Эпизоды', m.episodes ? String(m.episodes) : null],
				['Статус', m.status ? (SERIES_STATUS[m.status] ?? m.status) : null],
				['Страны', list(m.countries, countryName)]
			);
			break;
		}
		case 'book': {
			const m = metadata as SchemaBookMetadata;
			rows.push(
				['Страниц', m.pages ? m.pages.toLocaleString('ru-RU') : null],
				['Издатель', m.publisher],
				['ISBN', m.isbn]
			);
			break;
		}
		case 'game': {
			const m = metadata as SchemaGameMetadata;
			rows.push(
				['Платформы', list(m.platforms, platformLabel)],
				['Разработчик', m.developer],
				['Издатель', m.publisher]
			);
			break;
		}
	}
	return rows
		.filter((r): r is [string, string] => !!r[1])
		.map(([label, value]) => ({ label, value }));
}

/** '2021-10-22' → '2021'; нет даты — null. */
export function yearOf(date: string | null | undefined): string | null {
	return date ? date.slice(0, 4) : null;
}

/** '1965-08-01' → «1 августа 1965 г.» (дата без времени, без сдвига часовых поясов). */
export function formatDate(date: string): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** Описание для meta description: одна строка, не длиннее max символов, обрезка по слову. */
export function summary(text: string | null | undefined, max = 160): string {
	const flat = (text ?? '').replace(/\s+/g, ' ').trim();
	if (flat.length <= max) return flat;
	const cut = flat.slice(0, max - 1);
	const space = cut.lastIndexOf(' ');
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
}

/** Роль с персонажем: «Актёр — Пол Атрейдес». */
export function creditLabel(credit: { role: string; character_name?: string | null }): string {
	return credit.character_name
		? `${roleLabel(credit.role)} — ${credit.character_name}`
		: roleLabel(credit.role);
}

/**
 * Работы человека для сетки: одна карточка на произведение, все роли в подписи
 * («Режиссёр, Сценарист»). Порядок — как пришёл от API (новые сверху).
 */
export function groupWorks<E extends { id: string }>(
	credits: { entity: E; role: string; character_name?: string | null }[]
): { entity: E; caption: string }[] {
	const byEntity = new Map<string, { entity: E; roles: string[] }>();
	for (const credit of credits) {
		const work = byEntity.get(credit.entity.id) ?? { entity: credit.entity, roles: [] };
		const label = creditLabel(credit);
		if (!work.roles.includes(label)) work.roles.push(label);
		byEntity.set(credit.entity.id, work);
	}
	return [...byEntity.values()].map(({ entity, roles }) => ({ entity, caption: roles.join(', ') }));
}

/**
 * Короткая строка фактов в шапке карточки, как у Okko: год, длительность или сезоны, страницы,
 * разработчик. Остальные поля metadata — ниже, в списке.
 */
export function keyFacts(
	kind: SchemaEntityKind,
	metadata: SchemaMetadata,
	releaseDate: string | null | undefined
): string[] {
	const facts: (string | null | undefined)[] = [yearOf(releaseDate)];
	switch (kind) {
		case 'movie': {
			const m = metadata as SchemaMovieMetadata;
			facts.push(m.runtime_min ? formatRuntime(m.runtime_min) : null);
			break;
		}
		case 'series': {
			const m = metadata as SchemaSeriesMetadata;
			facts.push(m.seasons ? count(m.seasons, ['сезон', 'сезона', 'сезонов']) : null);
			break;
		}
		case 'book': {
			const m = metadata as SchemaBookMetadata;
			facts.push(m.pages ? count(m.pages, ['страница', 'страницы', 'страниц']) : null);
			break;
		}
		case 'game': {
			const m = metadata as SchemaGameMetadata;
			facts.push(m.developer);
			break;
		}
	}
	return facts.filter((f): f is string => !!f);
}

/** Возрастной рейтинг для бейджа в шапке (есть только у фильмов). */
export function ageRating(kind: SchemaEntityKind, metadata: SchemaMetadata): string | null {
	return kind === 'movie' ? ((metadata as SchemaMovieMetadata).age_rating ?? null) : null;
}

// Кого показывать строкой «Режиссёр: …» в шапке — по типу, первая роль, которая есть.
const LEAD_ROLES: Record<SchemaEntityKind, string[]> = {
	movie: ['director'],
	series: ['creator', 'director'],
	book: ['author'],
	game: ['director', 'developer', 'creator']
};

/** Главная роль, которая есть у произведения: director, у книг author и т. д.; нет — null. */
export function leadRole(kind: SchemaEntityKind, credits: { role: string }[]): string | null {
	return LEAD_ROLES[kind].find((role) => credits.some((c) => c.role === role)) ?? null;
}

/** Главные люди произведения: «Режиссёр» и люди с этой ролью в порядке титров. */
export function leadCredits<P>(
	kind: SchemaEntityKind,
	credits: { role: string; person: P }[]
): { label: string; people: P[] } | null {
	const role = leadRole(kind, credits);
	if (!role) return null;
	return {
		label: roleLabel(role),
		people: credits.filter((c) => c.role === role).map((c) => c.person)
	};
}
