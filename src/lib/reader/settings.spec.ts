import { describe, expect, it } from 'vitest';
import { layoutAttributes, parseSettings } from './settings.ts';

describe('parseSettings', () => {
	it('умолчания: телефон — лента, большой экран — страница', () => {
		expect(parseSettings(null, true).layout).toBe('scroll');
		expect(parseSettings(null, false).layout).toBe('page');
	});
	it('сохранённое поверх умолчаний, мусор — умолчание', () => {
		expect(parseSettings('{"theme":"dark","layout":"spread","fontSize":500}', true)).toEqual({
			theme: 'dark',
			layout: 'spread',
			fontSize: 200
		});
		expect(parseSettings('{"theme":"x","layout":"y"}', false)).toMatchObject({
			theme: 'light',
			layout: 'page'
		});
		expect(parseSettings('не json', false).theme).toBe('light');
	});
});

describe('layoutAttributes', () => {
	it('страница — одна колонка, разворот — две, лента — прокрутка', () => {
		expect(layoutAttributes('page')).toMatchObject({ flow: 'paginated', 'max-column-count': '1' });
		expect(layoutAttributes('spread')).toMatchObject({
			flow: 'paginated',
			'max-column-count': '2'
		});
		expect(layoutAttributes('scroll').flow).toBe('scrolled');
	});
});
