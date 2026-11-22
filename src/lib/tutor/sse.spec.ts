import { describe, expect, it } from 'vitest';
import { SseParser } from './sse.ts';

describe('SseParser', () => {
	it('события по кускам, хвост ждёт следующего куска, keep-alive пропускается', () => {
		const p = new SseParser();
		expect(p.push('event: delta\ndata: {"text":"При"}\n\nevent: del')).toEqual([
			{ event: 'delta', data: '{"text":"При"}' }
		]);
		expect(p.push('ta\ndata: {"text":"вет"}\n\n:\n\n')).toEqual([
			{ event: 'delta', data: '{"text":"вет"}' }
		]);
		expect(p.push('event: done\r\ndata: {}\r\n\r\n')).toEqual([{ event: 'done', data: '{}' }]);
	});
});
