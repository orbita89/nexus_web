// slug для URL: латиница в нижнем регистре, цифры и одиночные дефисы, до 100 символов —
// правило бэкенда. Форма берёт оригинальное название, если оно есть (Dune, 2021 → dune-2021),
// иначе русское с транслитерацией («Метро 2033» → metro-2033).

const RU: Record<string, string> = {
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
	я: 'ya'
};

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Название (и год) → slug: «Дюна: Часть вторая», 2024 → dyuna-chast-vtoraya-2024. */
export function slugify(text: string, year?: string | null): string {
	const latin = [...text.toLowerCase()].map((c) => RU[c] ?? c).join('');
	const base = latin
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const withYear = year ? `${base}-${year}` : base;
	return withYear.slice(0, 100).replace(/-+$/, '');
}

export function slugError(slug: string): string | null {
	if (!slug) return 'Введите slug.';
	if (slug.length > 100) return 'slug — не длиннее 100 символов.';
	if (!SLUG_RE.test(slug)) return 'slug: латиница в нижнем регистре, цифры и дефисы (dune-2021).';
	return null;
}
