// Слой Б (GET /admin/search/sidecar): подписи частей и группировка для страницы «Слой Б».
import type { SchemaSidecarPart } from '#lib/api/generated/catalog.ts';

export type PartGroup = 'Сущности' | 'Порядки сортировки' | 'Фасеты (фильтры)' | 'Люди';

const ORDER_TITLES: Record<string, string> = {
	recommended: '«Рекомендуемые»: ручные места, затем балл',
	new: '«Новинки»: по дате выхода',
	title: '«По названию»: алфавит',
	popular: '«Популярные»',
	rating: '«По рейтингу»',
	trending: '«В тренде»',
	top_rated: '«Лучшие»',
	awarded: '«С наградами»',
	fame: 'Люди по известности',
	name: 'Люди по имени'
};

const FIXED: Record<string, string> = {
	meta: 'SortMeta, 8 байт на сущность: ручное место, флаги (обложка, описание, автор), популярность для поиска',
	base_rank: 'Балл «Рекомендуемые» + дата, 8 байт на сущность',
	release_day: 'Дата выхода в днях, 4 байта на сущность: «вышло / не вышло»',
	'facet:visible': 'Битовая карта видимых сущностей',
	'facet:cover': 'Битовая карта «есть обложка»',
	'facet:year': 'Битовые карты по годам',
	'people:fame': 'Известность, 4 байта на человека',
	'people:visible': 'Битовая карта видимых людей'
};

/** Подпись части по её имени. */
export function describePart(name: string): string {
	if (name === 'people:roles') return 'Битовые карты ролей людей (актёр, режиссёр…)';
	if (FIXED[name]) return FIXED[name];
	const order = name.match(/^(?:people:)?order:(.+)$/);
	if (order) return `Готовый порядок ${ORDER_TITLES[order[1]] ?? order[1]}, 4 байта на номер`;
	const role = name.match(/^people:role:(.+)$/);
	if (role) return `Люди с основной ролью «${role[1]}»`;
	const hints = name.match(/^hints:(.+)$/);
	if (hints) return `Подсказки фильтра «${hints[1]}»: название и готовые счётчики по видам`;
	const facet = name.match(/^facet:(.+)$/);
	if (facet) return `Битовые карты фильтра «${facet[1]}»: по одной на значение`;
	return name;
}

export function groupOf(name: string): PartGroup {
	if (name.startsWith('people:')) return 'Люди';
	if (name.startsWith('order:')) return 'Порядки сортировки';
	if (name.startsWith('facet:') || name.startsWith('hints:')) return 'Фасеты (фильтры)';
	return 'Сущности';
}

/** Части по группам, крупные сверху; роли людей сворачиваются в одну строку. */
export function groupParts(parts: SchemaSidecarPart[]) {
	const groups = new Map<PartGroup, SchemaSidecarPart[]>();
	const roles: SchemaSidecarPart = { name: 'people:roles', bytes: 0, items: 0, mapped: false };
	for (const p of parts) {
		if (p.name.startsWith('people:role:')) {
			roles.bytes += p.bytes;
			roles.items += 1;
			continue;
		}
		const g = groupOf(p.name);
		groups.set(g, [...(groups.get(g) ?? []), p]);
	}
	if (roles.items) groups.set('Люди', [...(groups.get('Люди') ?? []), roles]);
	return [...groups.entries()].map(([group, list]) => ({
		group,
		bytes: list.reduce((s, p) => s + p.bytes, 0),
		parts: list.toSorted((a, b) => b.bytes - a.bytes)
	}));
}

export function formatBytes(n: number): string {
	if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(2)} ГБ`;
	if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} МБ`;
	if (n >= 1 << 10) return `${Math.round(n / (1 << 10))} КБ`;
	return `${n} Б`;
}
