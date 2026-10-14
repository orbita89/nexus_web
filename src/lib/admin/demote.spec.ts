import { describe, expect, it } from 'vitest';
import { ApiError } from '#lib/api/errors.ts';
import { demoteError, demoteSummary, skipReason } from './demote';

describe('перенос в архив', () => {
	it('итог и причины пропуска', () => {
		expect(demoteSummary({ archived: ['a'], skipped: [] }, 1)).toBe('Фильм перенесён в архив.');
		expect(demoteSummary({ archived: ['a', 'b'], skipped: [] }, 2)).toBe('Перенесено: 2.');
		const partial = { archived: ['a'], skipped: [{ slug: 'b', reason: 'in_use' as const }] };
		expect(demoteSummary(partial, 2)).toBe('Перенесено 1 из 2.');
		expect(skipReason('in_use')).toBe('есть данные пользователей');
		expect(skipReason('not_found')).toBe('уже в архиве или нет на сайте');
		expect(skipReason('no_tmdb')).toBe('не из TMDB');
		expect(skipReason('другое')).toBe('другое');
	});

	it('ошибки', () => {
		expect(demoteError(new ApiError(409, 'archive is being rebuilt', null, 'conflict'))).toMatch(
			/пересобирается/
		);
		expect(demoteError(new ApiError(503, null, null, 'unavailable'))).toMatch(/недоступен/);
		expect(demoteError(new ApiError(403, null, null, 'forbidden'))).toBe('Недостаточно прав.');
	});
});
