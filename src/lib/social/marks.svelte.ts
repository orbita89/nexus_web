// Личные отметки на карточке: «Посмотреть позже» и «Просмотрено» (у книг — прочитать, у игр —
// пройти). Взаимоисключающие: просмотрел — из «позже» уходит. Потом — списки в личном кабинете.
// API ещё нет (docs/backend-questions.md): пока отметки хранятся в браузере, у каждого
// пользователя свои (ключ с id). Появится API — меняется только этот файл.
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
import { session } from '#lib/auth/session.svelte.ts';

export type Mark = 'later' | 'done';

const key = (userId: string) => `nexus.marks.${userId}`;

function readAll(userId: string): Record<string, Mark> {
	try {
		return JSON.parse(localStorage.getItem(key(userId)) ?? '{}');
	} catch {
		return {};
	}
}

export class Marks {
	/** null — нет отметки или ещё не знаем (гость, сессия грузится). */
	mark = $state<Mark | null>(null);

	#slug: () => string;

	/** Создавать при инициализации компонента. */
	constructor(slug: () => string) {
		this.#slug = slug;
		$effect(() => {
			const id = session.user?.id;
			this.mark = id ? (readAll(id)[slug()] ?? null) : null;
		});
	}

	/** Поставить отметку; повторно ту же — снять. */
	toggle(mark: Mark) {
		const id = session.user?.id;
		if (!id) return;
		this.mark = this.mark === mark ? null : mark;
		const all = readAll(id);
		if (this.mark) all[this.#slug()] = this.mark;
		else delete all[this.#slug()];
		try {
			localStorage.setItem(key(id), JSON.stringify(all));
		} catch {
			// приватный режим или квота — отметка живёт до перезагрузки
		}
	}
}

/** Подписи по типу: «Посмотреть позже» / «Просмотрено», «Прочитать позже» / «Прочитано»… */
export function markLabels(kind: SchemaEntityKind): Record<Mark, string> {
	switch (kind) {
		case 'book':
			return { later: 'Прочитать позже', done: 'Прочитано' };
		case 'game':
			return { later: 'Пройти позже', done: 'Пройдено' };
		default:
			return { later: 'Посмотреть позже', done: 'Просмотрено' };
	}
}
