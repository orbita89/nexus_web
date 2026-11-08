// Картина: исходник для увеличения и фрагменты полотна. Фрагмент — не отдельный файл, а
// прямоугольник на самом холсте (доли 0–1), поэтому кроп фронтенд собирает сам: либо просит
// нужный кусок у IIIF, либо показывает исходник со сдвигом под окном карточки.
import type {
	SchemaCrop,
	SchemaEntityDetail,
	SchemaPaintingMetadata
} from '#lib/api/generated/catalog.ts';

/** Холст, который показываем: исходник, если он есть, иначе обложка выдачи. */
export interface Canvas {
	src: string;
	/** Пиксели именно того файла, что скачает браузер; неизвестны — null. */
	width: number | null;
	height: number | null;
	/** Адрес IIIF без хвостового слэша: по нему просим готовые кропы. */
	iiif: string | null;
}

/** Исходник картины для увеличения и кропов; нечего показать — null. */
export function canvasOf(entity: SchemaEntityDetail): Canvas | null {
	const m = entity.kind === 'painting' ? (entity.metadata as SchemaPaintingMetadata) : null;
	const src = m?.image_url ?? entity.cover_url;
	if (!src) return null;
	// Размеры — только вместе с исходником: у обложки они другие, и доли кропа по ним не перевести.
	const full = !!m?.image_url;
	return {
		src,
		width: full ? (m?.image_width ?? null) : null,
		height: full ? (m?.image_height ?? null) : null,
		iiif: m?.iiif_base?.replace(/\/+$/, '') || null
	};
}

/** Разбор картины: связный текст и тезисы-символы; не картина или не написан — null. */
export function analysisOf(entity: SchemaEntityDetail) {
	if (entity.kind !== 'painting') return null;
	const analysis = (entity.metadata as SchemaPaintingMetadata).analysis;
	return analysis?.text ? analysis : null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Квадрат вокруг фрагмента: карточки ленты квадратные, а кроп — какой угодно. Растягивать его
 * под карточку нельзя (лицо станет блином), поэтому расширяем короткую сторону до квадрата в
 * пикселях холста и прижимаем к краю, если упёрлись. Пропорции холста неизвестны — считаем
 * квадратным: ошибёмся в кадрировании, но не в форме лиц.
 */
export function squareCrop(crop: SchemaCrop, canvas: Canvas): SchemaCrop {
	const aspect = canvas.width && canvas.height ? canvas.width / canvas.height : 1;
	// Сторона квадрата в долях ширины и высоты: в пикселях они равны.
	const side = Math.max(crop.width, crop.height / aspect);
	const width = Math.min(1, side);
	const height = Math.min(1, side * aspect);
	return {
		width,
		height,
		// Центр сохраняем, но за край не вылезаем: у края холста квадрат просто прижимается к нему.
		x: Math.min(1 - width, clamp01(crop.x + crop.width / 2 - width / 2)),
		y: Math.min(1 - height, clamp01(crop.y + crop.height / 2 - height / 2))
	};
}

/**
 * Адрес готового кропа у IIIF: регион в пикселях, если известны размеры, иначе в процентах.
 * `size` — ширина картинки в пикселях, высота по пропорции.
 */
export function iiifCrop(canvas: Canvas, crop: SchemaCrop, size = 600): string | null {
	if (!canvas.iiif) return null;
	const pct = (v: number) => +(v * 100).toFixed(3);
	const region =
		canvas.width && canvas.height
			? [
					Math.round(crop.x * canvas.width),
					Math.round(crop.y * canvas.height),
					Math.round(crop.width * canvas.width),
					Math.round(crop.height * canvas.height)
				].join(',')
			: `pct:${pct(crop.x)},${pct(crop.y)},${pct(crop.width)},${pct(crop.height)}`;
	return `${canvas.iiif}/${region}/${size},/0/default.jpg`;
}

/**
 * Кроп без IIIF: тот же файл фоном, увеличенный так, что в окно карточки попадает только нужный
 * прямоугольник. Проценты позиции считаются от свободного места, отсюда деление на (1 - сторона).
 */
export function cropStyle(canvas: Canvas, crop: SchemaCrop): string {
	const place = (offset: number, side: number) =>
		side >= 1 ? 50 : +((offset / (1 - side)) * 100).toFixed(3);
	return [
		`background-image: url("${canvas.src}")`,
		`background-size: ${(100 / crop.width).toFixed(3)}% ${(100 / crop.height).toFixed(3)}%`,
		`background-position: ${place(crop.x, crop.width)}% ${place(crop.y, crop.height)}%`
	].join('; ');
}
