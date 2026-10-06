import { describe, expect, it } from 'vitest';
import {
	displayName,
	formatRating,
	isEdited,
	ratingTone,
	readSort,
	reviewDate,
	sortParam
} from './reviews';

const url = (s: string) => new URL(s, 'http://localhost');

describe('сортировка в адресе', () => {
	it('читает известную, иначе «новые»', () => {
		expect(readSort(url('/films/dune-2021?sort=rating_desc'))).toBe('rating_desc');
		expect(readSort(url('/films/dune-2021?sort=rating_asc'))).toBe('rating_asc');
		expect(readSort(url('/films/dune-2021'))).toBe('new');
		expect(readSort(url('/films/dune-2021?sort=oops'))).toBe('new');
	});

	it('«новые» в адрес не пишутся', () => {
		expect(sortParam('new')).toBeNull();
		expect(sortParam('rating_desc')).toBe('rating_desc');
	});
});

describe('оценка', () => {
	it('цвет: 7+ высокая, 5+ средняя, ниже — низкая', () => {
		expect(ratingTone(10)).toBe('high');
		expect(ratingTone(7)).toBe('high');
		expect(ratingTone(6.9)).toBe('mid');
		expect(ratingTone(5)).toBe('mid');
		expect(ratingTone(4.9)).toBe('low');
		expect(ratingTone(1)).toBe('low');
	});

	it('формат', () => {
		expect(formatRating(8)).toBe('8');
		expect(formatRating(8, { average: true })).toBe('8,0');
		expect(formatRating(6.5, { average: true })).toBe('6,5');
	});
});

describe('рецензия', () => {
	it('дата по UTC — одинаково на сервере и в браузере', () => {
		expect(reviewDate('2026-10-07T23:30:00Z')).toBe('7 октября 2026 г.');
	});

	it('«изменено» — только если правили позже минуты после создания', () => {
		const created_at = '2026-10-07T10:00:00Z';
		expect(isEdited({ created_at, updated_at: '2026-10-07T10:00:30Z' })).toBe(false);
		expect(isEdited({ created_at, updated_at: '2026-10-07T12:00:00Z' })).toBe(true);
	});

	it('имя автора', () => {
		expect(displayName({ username: 'user', display_name: 'Обычный пользователь' })).toBe(
			'Обычный пользователь'
		);
		expect(displayName({ username: 'user', display_name: '  ' })).toBe('user');
		expect(displayName({ username: 'user' })).toBe('user');
	});
});
