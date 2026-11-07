// Выбор страны в фильтрах раздела. Фасета стран у бэкенда пока нет (просили в
// docs/backend-tasks/search-country.md), поэтому список кодов держим у себя: это не фильтрация
// каталога, а словарь значений для поля — сама выдача приходит из Meilisearch по ?country=.
//
// Здесь не все 249 кодов ISO, а те, что реально встречаются в кино, сериалах и играх: длинный
// список в подсказках бесполезен, а названия всё равно берутся из Intl (countryName).
import { countryName } from './labels.ts';

const CODES = [
	'US',
	'GB',
	'RU',
	'SU',
	'FR',
	'DE',
	'IT',
	'ES',
	'JP',
	'KR',
	'CN',
	'HK',
	'TW',
	'IN',
	'CA',
	'AU',
	'NZ',
	'IE',
	'SE',
	'NO',
	'DK',
	'FI',
	'IS',
	'NL',
	'BE',
	'AT',
	'CH',
	'PL',
	'CZ',
	'SK',
	'HU',
	'RO',
	'BG',
	'GR',
	'PT',
	'TR',
	'UA',
	'BY',
	'KZ',
	'GE',
	'AM',
	'IL',
	'IR',
	'AE',
	'SA',
	'EG',
	'ZA',
	'NG',
	'BR',
	'AR',
	'MX',
	'CL',
	'CO',
	'TH',
	'VN',
	'ID',
	'PH',
	'MY',
	'SG',
	'RS',
	'HR',
	'SI',
	'EE',
	'LV',
	'LT'
];

export interface CountryOption {
	/** Код ISO 3166-1 alpha-2 — он уходит в адрес и в API. */
	value: string;
	/** Название по-русски — его видит человек. */
	label: string;
}

/**
 * Без запроса — в порядке списка кодов: он от частых к редким, и в коротком окне выбора сверху
 * оказываются страны, которые ищут чаще всего, а не те, что раньше по алфавиту. С запросом —
 * по алфавиту: там порядок нужен предсказуемый.
 */
export function countryOptions(q: string): CountryOption[] {
	const all = CODES.map((value) => ({ value, label: countryName(value) }));
	const needle = q.trim().toLowerCase();
	if (!needle) return all;
	return all
		.toSorted((a, b) => a.label.localeCompare(b.label, 'ru'))
		.filter((c) => c.label.toLowerCase().startsWith(needle) || c.value.toLowerCase() === needle);
}
