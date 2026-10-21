// Читаемый адрес особой коллекции (/collections/{slug}): транслит и проверка — правила бэкенда.

export const SLUG_MIN = 3;
export const SLUG_MAX = 100;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Служебные слова — заняты роутами сайта/API. */
export const RESERVED_SLUGS = new Set([
	'featured',
	'new',
	'by-slug',
	'admin',
	'create',
	'edit',
	'search'
]);

const MAP: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ё: 'e',
	ж: 'zh',
	з: 'z',
	и: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'kh',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'shch',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya',
	і: 'i',
	ї: 'yi',
	є: 'ye',
	ґ: 'g'
};

/** Предложение адреса из названия: «Русский топ 2021» → russkiy-top-2021. */
export function slugify(title: string): string {
	// Сначала кириллица (до NFKD: иначе «й» распадётся на «и» + бреве), затем снимаем диакритику.
	const latin = [...title.toLowerCase().normalize('NFC')]
		.map((ch) => MAP[ch] ?? ch)
		.join('')
		.normalize('NFKD')
		.replace(/\p{M}/gu, '');
	let slug = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	if (slug.length > SLUG_MAX) slug = slug.slice(0, SLUG_MAX).replace(/-+$/, '');
	return slug;
}

/** Ошибка адреса или null — всё в порядке. */
export function slugError(slug: string): string | null {
	if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return 'Адрес — от 3 до 100 символов.';
	if (!SLUG_RE.test(slug)) return 'Только латиница a–z, цифры и дефисы между ними.';
	if (UUID_RE.test(slug)) return 'Адрес не может быть UUID.';
	if (RESERVED_SLUGS.has(slug)) return 'Это служебное слово — выберите другой адрес.';
	return null;
}

export function isUuid(value: string): boolean {
	return UUID_RE.test(value);
}
