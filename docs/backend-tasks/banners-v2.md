# Баннеры v2: HTML-контент, слайды, кнопки, показ на любых страницах (задача бэкенду)

Сейчас (nexus `80b3e21`) баннер — это картинка + заголовок + одна ссылка, привязанная к одной
из 6 страниц (`page`). Нужно, чтобы админ мог собрать промо вроде «Хеллоуин»: свой HTML-текст,
несколько слайдов, несколько кнопок (например, на особую коллекцию) и показывать его на всех
страницах сайта или только на выбранных.

## Новые поля Banner

```ts
type Banner = {
	// …все текущие поля остаются (image_url становится nullable, см. ниже)
	kind: 'image' | 'html' | 'slides'; // default 'image' — старые баннеры работают как раньше
	content_html: string | null; // для kind=html (и как текст поверх картинки для image)
	slides: BannerSlide[]; // для kind=slides, 1..10, порядок = порядок показа
	buttons: BannerButton[]; // 0..3, кнопки поверх баннера
	theme: string | null; // пресет оформления, те же id что у особых коллекций:
	// default, halloween, romance, new-year, horror, sci-fi, family, summer
	targets: BannerTarget[]; // где показывать, ≥1
	priority: number; // при показе на одной странице: priority desc, затем position
};

type BannerSlide = {
	image_url: string | null; // http(s)
	title: string | null; // ≤300
	subtitle: string | null;
	content_html: string | null;
	link_url: string | null; // как у баннера: http(s) или путь "/…" (не "//")
};

type BannerButton = {
	label: string; // 1..60
	url: string; // http(s) или путь "/…"
	style: 'primary' | 'secondary' | 'ghost';
};

type BannerTarget =
	| { type: 'all' } // все страницы сайта
	| { type: 'page'; page: 'home' | 'films' | 'series' | 'books' | 'games' | 'people' }
	| { type: 'path'; pattern: string }; // "/collections/*", "/films/dune-2021"
```

`image_url` — обязателен только для `kind=image`. `page` в ответе оставить на переходный период
(первый `targets[].page` или `null`).

### content_html

- Санитизация **на сервере** при сохранении (allowlist), фронт дополнительно чистит DOMPurify.
- Разрешено: `p, br, h2, h3, h4, strong, em, b, i, u, s, span, ul, ol, li, a, img, small, mark`.
- Атрибуты: `a[href]` (http(s) или путь `/…`; `target`/`rel` выставляет фронт), `img[src, alt, width, height]`
  (src только https), `class` — только из списка `text-*`, `font-*`, `text-center|left|right`
  (иначе вырезать). Никаких `style`, `on*`, `script`, `iframe`, `form`.
- Лимит 20 000 символов после санитизации. Невалидное → 400 `code: "validation"`, `field: "content_html"`.

### targets

- `{type:'path'}`: `pattern` начинается с `/`, `*` — любой хвост сегмента/пути (`/collections/*`
  совпадает с `/collections/abc` и `/collections/abc/edit`), без query и `#`. ≤ 200 символов, ≤ 20 targets.
- Опционально `exclude_paths: string[]` — шаблоны, где **не** показывать (например, `/admin/*` по умолчанию
  исключён всегда).

## Эндпоинты

Публичный, кроме текущего `?page=` (оставить для совместимости):

```
GET /api/v1/catalog/banners?path=/films/dune-2021
```

- Возвращает активные баннеры в периоде, у которых совпал хотя бы один target
  (`all`; `page`, соответствующий пути: `/`→home, `/films`→films, `/series`→series, `/books`→books,
  `/games`→games, `/people`→people; либо `path`-шаблон) и не совпал `exclude_paths`.
- Сортировка `priority desc, position asc`, ≤ 20. Кэшируемо (`Cache-Control: public, max-age=60`).

Админка: те же POST/PATCH/GET/DELETE, тело принимает новые поля; в `GET admin/banners` добавить
фильтр `?target=all|<page>|path` и `?q=` по заголовку. PATCH массивов (`slides`, `buttons`, `targets`)
заменяет массив целиком.

Валидация (400, `{error, code:"validation", field}`): `slides` непусты при `kind=slides`;
`content_html` непуст при `kind=html`; `targets` ≥1; URL-правила как сейчас; `ends_at > starts_at`.

## Тестовый баннер после реализации

Создать (и прислать id):

```json
{
	"kind": "html",
	"title": "Хеллоуин на Nexus",
	"theme": "halloween",
	"image_url": "<любая тёмная осенняя картинка 16:9>",
	"content_html": "<h2>Хеллоуин на Nexus 🎃</h2><p>Самые <strong>страшные</strong> фильмы, сериалы и игры — в одной подборке.</p>",
	"buttons": [
		{
			"label": "Открыть подборку",
			"url": "/collections/<id особой коллекции «Хеллоуин»>",
			"style": "primary"
		},
		{ "label": "Ужасы в каталоге", "url": "/films?genre=horror", "style": "ghost" }
	],
	"targets": [{ "type": "all" }],
	"priority": 10,
	"starts_at": "2026-10-20T00:00:00Z",
	"ends_at": "2026-11-02T00:00:00Z"
}
```

Если особой коллекции «Хеллоуин» нет — создать её (особая, `theme: "halloween"`).

## Фронт после реализации

Перегенерировать `src/lib/api/generated/catalog.ts`; `BannerCarousel` рендерит `kind`
(image/html/slides), кнопки и тему; баннеры грузятся один раз в корневом `+layout.server.ts`
по `url.pathname` вместо постраничных загрузок; админка — редактор слайдов, кнопок, целей и HTML с превью.

Попутно: в контракте `page`, `limit`, `offset` у списков баннеров описаны как path-параметры —
должны быть query.
