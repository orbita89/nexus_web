// Форма произведения в админке: поля metadata по типу ↔ JSON для API. Правила — как в бэкенде
// (nexus_project/documents/modules/catalog.md): числа в диапазонах, страны ISO alpha-2, до 5
// трейлеров. Пустое поле в metadata не попадает.
import type {
	SchemaBookMetadata,
	SchemaEntityKind,
	SchemaGameMetadata,
	SchemaMetadata,
	SchemaMovieMetadata,
	SchemaSeriesMetadata,
	SchemaSeriesStatus,
	SchemaTrailerProvider
} from '#lib/api/generated/catalog.ts';

export interface TrailerRow {
	provider: SchemaTrailerProvider;
	/** id или ссылка на видео — бэкенд разберёт ссылку сам. */
	id: string;
}

export interface MetadataForm {
	runtime_min: string;
	countries: string;
	age_rating: string;
	seasons: string;
	episodes: string;
	status: SchemaSeriesStatus | '';
	isbn: string;
	pages: string;
	publisher: string;
	platforms: string;
	developer: string;
	trailers: TrailerRow[];
}

export const emptyMetadataForm = (): MetadataForm => ({
	runtime_min: '',
	countries: '',
	age_rating: '',
	seasons: '',
	episodes: '',
	status: '',
	isbn: '',
	pages: '',
	publisher: '',
	platforms: '',
	developer: '',
	trailers: []
});

export const TRAILER_LIMIT = 5;
export const WITH_TRAILERS: readonly SchemaEntityKind[] = ['movie', 'series', 'game'];

/** «US, ca  GB» → ['US', 'CA', 'GB']; «pc, ps5» → ['pc', 'ps5'] (без повторов). */
export function splitList(text: string, upper = false): string[] {
	const items = text
		.split(/[,;\s]+/)
		.map((s) => s.trim())
		.filter(Boolean)
		.map((s) => (upper ? s.toUpperCase() : s.toLowerCase()));
	return [...new Set(items)];
}

/** Провайдер по вставленной ссылке; не ссылка — null (оставить выбранный). */
export function detectProvider(text: string): SchemaTrailerProvider | null {
	const value = text.trim().toLowerCase();
	if (/^(https?:\/\/)?([\w-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//.test(value)) {
		return 'youtube';
	}
	if (/^(https?:\/\/)?([\w-]+\.)?rutube\.ru\//.test(value)) return 'rutube';
	return null;
}

const int = (s: string) => (s.trim() ? Number(s.trim()) : null);
const text = (s: string) => s.trim() || null;

/** Форма → metadata для API: только поля этого типа и только заполненные. */
export function toMetadata(kind: SchemaEntityKind, form: MetadataForm): SchemaMetadata {
	const trailers = form.trailers
		.map((t) => ({ provider: t.provider, id: t.id.trim() }))
		.filter((t) => t.id);
	const entries: Record<string, unknown> = {};
	const put = (key: string, value: unknown) => {
		if (value !== null && value !== '' && !(Array.isArray(value) && !value.length)) {
			entries[key] = value;
		}
	};
	switch (kind) {
		case 'movie':
			put('runtime_min', int(form.runtime_min));
			put('countries', splitList(form.countries, true));
			put('age_rating', text(form.age_rating));
			put('trailers', trailers);
			break;
		case 'series':
			put('seasons', int(form.seasons));
			put('episodes', int(form.episodes));
			put('status', form.status || null);
			put('countries', splitList(form.countries, true));
			put('trailers', trailers);
			break;
		case 'book':
			put('isbn', form.isbn.replace(/[\s-]/g, '') || null);
			put('pages', int(form.pages));
			put('publisher', text(form.publisher));
			break;
		case 'game':
			put('platforms', splitList(form.platforms));
			put('developer', text(form.developer));
			put('publisher', text(form.publisher));
			put('trailers', trailers);
			break;
	}
	return entries as SchemaMetadata;
}

/** metadata из API → форма. */
export function fromMetadata(kind: SchemaEntityKind, metadata: SchemaMetadata): MetadataForm {
	const form = emptyMetadataForm();
	const n = (v: number | null | undefined) => (v == null ? '' : String(v));
	const m = metadata as SchemaMovieMetadata &
		SchemaSeriesMetadata &
		SchemaBookMetadata &
		SchemaGameMetadata;
	form.runtime_min = n(m.runtime_min);
	form.countries = (m.countries ?? []).join(', ');
	form.age_rating = m.age_rating ?? '';
	form.seasons = n(m.seasons);
	form.episodes = n(m.episodes);
	form.status = m.status ?? '';
	form.isbn = m.isbn ?? '';
	form.pages = n(m.pages);
	form.publisher = m.publisher ?? '';
	form.platforms = (m.platforms ?? []).join(', ');
	form.developer = m.developer ?? '';
	form.trailers = WITH_TRAILERS.includes(kind)
		? (m.trailers ?? []).map((t) => ({ provider: t.provider, id: t.id }))
		: [];
	return form;
}

/** Проверка metadata до отправки (бэкенд проверит ещё раз); null — всё в порядке. */
export function metadataError(kind: SchemaEntityKind, form: MetadataForm): string | null {
	const range = (value: string, label: string, max: number) => {
		if (!value.trim()) return null;
		const n = Number(value.trim());
		return Number.isInteger(n) && n >= 1 && n <= max
			? null
			: `${label}: целое от 1 до ${max.toLocaleString('ru-RU')}.`;
	};
	const countries = () =>
		splitList(form.countries, true).find((c) => !/^[A-Z]{2}$/.test(c))
			? 'Страны — коды из двух латинских букв через запятую: US, GB.'
			: null;
	const trailers = () =>
		form.trailers.filter((t) => t.id.trim()).length > TRAILER_LIMIT
			? `Не больше ${TRAILER_LIMIT} трейлеров.`
			: null;
	switch (kind) {
		case 'movie':
			return range(form.runtime_min, 'Длительность', 10_000) ?? countries() ?? trailers();
		case 'series':
			return (
				range(form.seasons, 'Сезоны', 10_000) ??
				range(form.episodes, 'Эпизоды', 100_000) ??
				countries() ??
				trailers()
			);
		case 'book':
			return range(form.pages, 'Страниц', 100_000);
		case 'game':
			return trailers();
	}
}
