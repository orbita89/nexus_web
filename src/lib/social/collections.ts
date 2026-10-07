// Коллекции: проверка форм и перестановка пунктов. Порядок сохраняется целиком
// (PUT /collections/{id}/items: все slug'и ровно по разу).

export const COLLECTION_LIMITS = { title: 200, description: 2000, note: 1000, items: 500 };

/** Проверка формы коллекции — правила бэкенда; null — всё в порядке. */
export function collectionFormError(form: { title: string; description: string }): string | null {
	const title = form.title.trim();
	if (!title) return 'Введите название.';
	if (title.length > COLLECTION_LIMITS.title) return 'Название — не длиннее 200 символов.';
	if (form.description.trim().length > COLLECTION_LIMITS.description) {
		return 'Описание — не длиннее 2000 символов.';
	}
	return null;
}

/** Переставить элемент: с позиции from на позицию to (новый массив). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
	if (from === to || from < 0 || from >= list.length) return [...list];
	const next = [...list];
	const [item] = next.splice(from, 1);
	next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
	return next;
}
