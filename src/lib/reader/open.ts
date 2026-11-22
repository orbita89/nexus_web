// Открыть книгу для читалки: из кэша (cache.ts) или с сервера, с проверкой доступа.
//
//   публичная: есть копия — она, без запроса; нет — скачать и сохранить;
//   закрытая:  HEAD с токеном → 200: копия (или скачать); 401/403: удалить копию, ошибка;
//              сети нет — открыть копию, если есть.
import { epubUrl } from './access.ts';
import { pruneOld, type BookCache } from './cache.ts';

export type OpenErrorKind =
	'login' | 'forbidden' | 'missing' | 'unavailable' | 'offline' | 'failed';

export class OpenError extends Error {
	constructor(
		readonly kind: OpenErrorKind,
		message: string
	) {
		super(message);
	}
}

const MESSAGES: Record<OpenErrorKind, string> = {
	login: 'Войдите, чтобы читать эту книгу.',
	forbidden: 'Эта книга доступна по приглашению.',
	missing: 'У этой книги пока нет файла.',
	unavailable: 'Файл книги сейчас недоступен на сервере. Попробуйте позже.',
	offline: 'Нет соединения, а копии книги на устройстве нет.',
	failed: 'Не удалось загрузить книгу. Попробуйте ещё раз.'
};

const fail = (kind: OpenErrorKind) => new OpenError(kind, MESSAGES[kind]);

function byStatus(status: number): OpenError {
	if (status === 401) return fail('login');
	if (status === 403) return fail('forbidden');
	if (status === 404) return fail('missing');
	if (status === 503) return fail('unavailable');
	return fail('failed');
}

export interface OpenDeps {
	cache: BookCache;
	/** fetch с токеном, если пользователь вошёл (api.authFetch); для гостя — обычный. */
	fetch: (request: Request) => Promise<Response>;
	now?: () => number;
}

export interface OpenOptions {
	publicRead: boolean;
	/** Ход скачивания: загружено и всего (total — из Content-Length или metadata.file.size). */
	onProgress?: (loaded: number, total: number | null) => void;
	size?: number | null;
}

/** Книга для читалки: Blob и откуда он (`cache` / `network`). */
export async function openBook(
	slug: string,
	{ publicRead, onProgress, size }: OpenOptions,
	{ cache, fetch, now = Date.now }: OpenDeps
): Promise<{ blob: Blob; from: 'cache' | 'network' }> {
	const url = new URL(epubUrl(slug), globalThis.location?.origin ?? 'http://localhost').toString();
	await pruneOld(cache, now()).catch(() => {});
	const cached = await cache.get(slug).catch(() => null);

	if (publicRead && cached) return { blob: cached.blob, from: 'cache' };

	if (!publicRead && cached) {
		let head: Response;
		try {
			head = await fetch(new Request(url, { method: 'HEAD' }));
		} catch {
			// Сети нет — читаем то, что уже сохранено: доступ проверим в следующий раз.
			return { blob: cached.blob, from: 'cache' };
		}
		if (head.ok) return { blob: cached.blob, from: 'cache' };
		if (head.status === 401 || head.status === 403 || head.status === 404) {
			await cache.remove(slug).catch(() => {});
		}
		throw byStatus(head.status);
	}

	let response: Response;
	try {
		response = await fetch(new Request(url));
	} catch {
		throw fail('offline');
	}
	if (!response.ok) throw byStatus(response.status);
	const blob = await readWithProgress(response, size ?? null, onProgress);
	await cache
		.put({ slug, blob, public: publicRead, savedAt: now(), size: blob.size })
		.catch(() => {}); // нет места или IndexedDB недоступен — просто не сохраняем
	return { blob, from: 'network' };
}

async function readWithProgress(
	response: Response,
	size: number | null,
	onProgress?: (loaded: number, total: number | null) => void
): Promise<Blob> {
	const type = response.headers.get('content-type') ?? 'application/epub+zip';
	const total = Number(response.headers.get('content-length')) || size;
	if (!response.body || !onProgress) return response.blob();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let loaded = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.length;
		onProgress(loaded, total);
	}
	return new Blob(chunks as BlobPart[], { type });
}

/** Место чтения (CFI) — в localStorage по slug; серверное сохранение — отдельная задача. */
const PLACE_KEY = (slug: string) => `nexus.read.${slug}`;

export function savedPlace(slug: string): string | null {
	try {
		return localStorage.getItem(PLACE_KEY(slug));
	} catch {
		return null;
	}
}

export function savePlace(slug: string, cfi: string) {
	try {
		localStorage.setItem(PLACE_KEY(slug), cfi);
	} catch {
		// не сохранили — откроется с начала
	}
}
