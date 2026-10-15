import { describe, expect, it } from 'vitest';
import { countryFlag, homepageLabel, studioHref } from './studios';

describe('studioHref', () => {
	it('адрес страницы студии', () => {
		expect(studioHref('mosfilm')).toBe('/studios/mosfilm');
	});
});

describe('countryFlag', () => {
	it('ISO-код → флаг, регистр не важен; мусор — пусто', () => {
		expect(countryFlag('US')).toBe('🇺🇸');
		expect(countryFlag('ru')).toBe('🇷🇺');
		expect(countryFlag('USA')).toBe('');
		expect(countryFlag('1A')).toBe('');
	});
});

describe('homepageLabel', () => {
	it('без схемы, www и хвостового слэша; путь остаётся', () => {
		expect(homepageLabel('https://www.warnerbros.com/')).toBe('warnerbros.com');
		expect(homepageLabel('http://mosfilm.ru/eng')).toBe('mosfilm.ru/eng');
	});

	it('не http(s) и не адрес — null (ссылку не рисуем)', () => {
		expect(homepageLabel('javascript:alert(1)')).toBeNull();
		expect(homepageLabel('warnerbros.com')).toBeNull();
	});
});
