// Разбор потока ответа ИИ (text/event-stream) из fetch: EventSource не подходит — он только GET и
// без заголовка Authorization.

export interface SseEvent {
	event: string;
	data: string;
}

/**
 * Читатель потока по кускам: отдаёт законченные события, хвост держит до следующего куска.
 * События разделены пустой строкой; строки `event:` и `data:` (несколько data — через \n).
 */
export class SseParser {
	#buffer = '';

	push(chunk: string): SseEvent[] {
		this.#buffer += chunk.replace(/\r\n/g, '\n');
		const events: SseEvent[] = [];
		let end: number;
		while ((end = this.#buffer.indexOf('\n\n')) >= 0) {
			const block = this.#buffer.slice(0, end);
			this.#buffer = this.#buffer.slice(end + 2);
			let event = 'message';
			const data: string[] = [];
			for (const line of block.split('\n')) {
				if (line.startsWith(':')) continue; // keep-alive
				if (line.startsWith('event:')) event = line.slice(6).trim();
				else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
			}
			if (data.length) events.push({ event, data: data.join('\n') });
		}
		return events;
	}
}
