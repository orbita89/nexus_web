import { describe, expect, it, vi } from 'vitest';
import { COVER_MAX_BYTES, coverFileError, coverPreview, uploadCover } from './cover.ts';

const file = (name: string, type: string, size = 10) =>
	new File([new Uint8Array(size)], name, { type });

describe('coverFileError', () => {
	it('принимает только AVIF', () => {
		expect(coverFileError(file('a.avif', 'image/avif'))).toBeNull();
		expect(coverFileError(file('a.AVIF', ''))).toBeNull();
		expect(coverFileError(file('a.jpg', 'image/jpeg'))).toMatch(/AVIF/);
	});
	it('не больше 10 МБ и не пустой', () => {
		expect(coverFileError(file('a.avif', 'image/avif', COVER_MAX_BYTES + 1))).toMatch(/10 МБ/);
		expect(coverFileError(file('a.avif', 'image/avif', 0))).toMatch(/пуст/);
	});
});

describe('coverPreview', () => {
	it('добавляет метку в обход кэша', () => {
		expect(coverPreview('http://x/c/1.avif', 0)).toBe('http://x/c/1.avif');
		expect(coverPreview('http://x/c/1.avif', 5)).toBe('http://x/c/1.avif?t=5');
		expect(coverPreview('http://x/c/1.avif?v=1', 5)).toBe('http://x/c/1.avif?v=1&t=5');
		expect(coverPreview(null, 5)).toBeNull();
	});
});

describe('uploadCover', () => {
	it('шлёт FormData с файлом на эндпоинт книги', async () => {
		const POST = vi.fn().mockResolvedValue({ data: { id: 'b1' }, response: new Response() });
		const cover = file('a.avif', 'image/avif');
		const result = await uploadCover({ catalog: { POST } } as never, 'b1', cover);
		expect(result).toEqual({ id: 'b1' });
		const [path, init] = POST.mock.calls[0]!;
		expect(path).toBe('/api/v1/catalog/admin/entities/{id}/cover');
		expect(init.params.path.id).toBe('b1');
		expect((init.body as FormData).get('file')).toBe(cover);
	});
});
