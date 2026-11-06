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

/** Страны по алфавиту; с запросом — те, чьё название или код начинается с него. */
export function countryOptions(q: string): CountryOption[] {
	const all = CODES.map((value) => ({ value, label: countryName(value) })).toSorted((a, b) =>
		a.label.localeCompare(b.label, 'ru')
	);
	const needle = q.trim().toLowerCase();
	if (!needle) return all;
	return all.filter(
		(c) => c.label.toLowerCase().startsWith(needle) || c.value.toLowerCase() === needle
	);
}
