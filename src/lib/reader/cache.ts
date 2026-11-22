// Книги на устройстве: IndexedDB `nexus-books`, хранилище `books`, ключ — slug.
//
// Публичные книги открываются из кэша без запроса. Закрытые — тоже из кэша, но перед каждым
// открытием читалка спрашивает сервер (HEAD, open.ts). Закрытые старше 30 дней удаляются, при
// выходе из аккаунта — все закрытые. navigator.storage.persist() не просим: браузер вправе
// вычистить кэш сам, книга тогда просто скачается заново.

export interface CachedBook {
	slug: string;
	blob: Blob;
	/** Публичная книга (public_read): проверять доступ не нужно. */
	public: boolean;
	/** Когда сохранили, мс. */
	savedAt: number;
	size: number;
}

/** Хранилище книг — интерфейс, чтобы логику открытия проверять без IndexedDB. */
export interface BookCache {
	get(slug: string): Promise<CachedBook | null>;
	put(book: CachedBook): Promise<void>;
	remove(slug: string): Promise<void>;
	all(): Promise<CachedBook[]>;
	clear(): Promise<void>;
}

/** Закрытые копии живут столько. */
export const PRIVATE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const DB = 'nexus-books';
const STORE = 'books';

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
	opening ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'slug' });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			opening = null;
			reject(request.error);
		};
	});
	return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
	return db().then(
		(d) =>
			new Promise<T>((resolve, reject) => {
				const request = work(d.transaction(STORE, mode).objectStore(STORE));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			})
	);
}

/** Кэш в IndexedDB браузера. */
export const idbCache: BookCache = {
	get: (slug) => run<CachedBook | undefined>('readonly', (s) => s.get(slug)).then((b) => b ?? null),
	put: (book) => run('readwrite', (s) => s.put(book)).then(() => undefined),
	remove: (slug) => run('readwrite', (s) => s.delete(slug)).then(() => undefined),
	all: () => run<CachedBook[]>('readonly', (s) => s.getAll()),
	clear: () => run('readwrite', (s) => s.clear()).then(() => undefined)
};

/** Удалить закрытые копии старше PRIVATE_MAX_AGE_MS. */
export async function pruneOld(cache: BookCache, now = Date.now()) {
	for (const book of await cache.all()) {
		if (!book.public && now - book.savedAt > PRIVATE_MAX_AGE_MS) await cache.remove(book.slug);
	}
}

/** Удалить все закрытые копии — при выходе из аккаунта. */
export async function removePrivate(cache: BookCache) {
	for (const book of await cache.all()) if (!book.public) await cache.remove(book.slug);
}

/** Сколько книг и байт на устройстве (для профиля). */
export async function cacheUsage(cache: BookCache) {
	const books = await cache.all();
	return { count: books.length, bytes: books.reduce((sum, b) => sum + b.size, 0) };
}
