# Особые коллекции: обои, тема, описания (задача бэкенду)

> **Сделано.** Бэкенд: nexus_project 2fba7bd (контракт `documents/api/social.json`). Фронт подключён:
> `FeaturedStyleForm.svelte` (обои, обложка, тема — на странице коллекции и в «Подборках»),
> шапка с обоями и og:image (`FeaturedCollectionView.svelte`), `entity.overview` под заметкой,
> админская правка состава чужой особой (`editsAsAdmin`, `putCollectionItem`/`deleteCollectionItem`
> в `src/lib/social/collections.ts`). Отличия от текста ниже: ошибки проверки — **400** `validation`
> (не 422); `409 not_featured` не нужен (PUT …/featured сам делает коллекцию особой), `not_featured`
> (400) — у админской правки состава. Порядок в админской правке — PUT с `position` для сдвинутых.

Особые коллекции создаёт и оформляет только админ. Нужно: обои (широкий фон страницы
коллекции), обложка карточки, тематический пресет и краткие описания фильмов внутри коллекции.

## 1. Оформление: `wallpaper_url`, `cover_url`, `theme`

Новые поля Collection — во **всех** ответах с Collection / CollectionDetail (список, деталь,
by-slug, `collections/featured`, профиль, preview):

| Поле            | Тип              | Смысл                                                                                                   |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `wallpaper_url` | `string \| null` | Обои: широкий фон/hero страницы `/collections/{slug}`. Рекомендуется 21:9 или 16:9, ≥ 1920px по ширине. |
| `cover_url`     | `string \| null` | Обложка карточки коллекции (главная, список особых). 16:9, ≥ 1280px.                                    |
| `theme`         | `string \| null` | id пресета оформления.                                                                                  |

Хранение изображений — как у баннеров (`image_url` в `catalog.json`, `/api/v1/catalog/admin/banners`):
обычный https-URL строкой, отдельного upload-эндпоинта нет. Если появится общий upload/media —
принимать его URL так же.

Пресеты `theme` (фронт: `src/lib/catalog/themes.ts` → `src/lib/social/featuredThemes.ts`),
строка без enum в БД, неизвестное значение фронт игнорирует:
`default` (Стандартная), `halloween` (Хеллоуин), `romance` (Мелодрама), `new-year` (Новый год),
`horror` (Ужасы), `sci-fi` (Фантастика), `family` (Семейное), `summer` (Лето).

Для не-особых коллекций все три поля всегда `null`.

### Эндпоинт

Расширить существующий `PUT /api/v1/social/admin/collections/{id}/featured` (роль admin).
Все поля необязательны; отсутствующее поле — не менять, `null` — сбросить:

```json
{
	"position": 3,
	"slug": "halloween-2026",
	"wallpaper_url": "https://cdn…/wall.jpg",
	"cover_url": "https://cdn…/cover.jpg",
	"theme": "halloween"
}
```

Ответ — обновлённая Collection (с новыми полями).

### Валидация и ошибки

- `wallpaper_url`, `cover_url`: https-URL, ≤ 2048 символов → иначе 422 `code: "validation"`, `field`.
- `theme`: `^[a-z0-9-]{1,32}$` → иначе 422 `code: "validation"`, `field: "theme"`.
- Коллекция не особая и запрос только меняет оформление → 409 `code: "not_featured"`.
- Приватная коллекция → 400 `code: "collection_private"` (сейчас фронт различает по тексту).
- Не админ → 403, нет коллекции → 404.

## 2. Описания фильмов в элементах коллекции

Сейчас `CollectionItem.entity` (EntityRef) = `{cover_url, id, kind, release_date, slug, title}` —
без описания, и страница коллекции выглядит пусто.

Добавить в `entity` элементов коллекции:

- `overview: string | null` — описание сущности, обрезанное до ≤ 1000 символов
  (по границе слова/предложения, без HTML).

Где: `GET /api/v1/social/collections/{id}` и by-slug (деталь коллекции). В превью/списках
не обязательно. Загружать одним батч-запросом к каталогу для всех items страницы — **без N+1**.
Если у сущности нет описания — `null`.

## 3. Админ редактирует состав особой коллекции

Сейчас добавлять и убирать фильмы может только владелец. Админу нужно то же
для любой особой коллекции:

- `PUT /api/v1/social/admin/collections/{id}/items/{slug}` — тело как у
  `PutCollectionItem` (`{note?, position?}`), ответ как у обычного PUT;
- `DELETE /api/v1/social/admin/collections/{id}/items/{slug}` → 204.

Только роль admin (иначе 403), только для `is_featured` (иначе 400).

## Фронт (сделано)

Все пункты ниже выполнены.

1. Перегенерировать `src/lib/api/generated/social.ts`.
2. Включить `FEATURED_STYLE_SUPPORTED` в `src/lib/social/featuredThemes.ts`, убрать
   StyleExtension-обход, добавить `wallpaper_url`.
3. `FeaturedAdminControls.svelte` и админка «Подборки» (`/admin/collections`): разблокировать поля
   «Обои», «Обложка», «Тема» и сохранять через `PUT …/featured`.
4. `FeaturedCollectionView.svelte`: обои — фон hero с градиентным оверлеем к фону страницы
   (читаемость заголовка); без обоев — тема/коллаж как сейчас. Слот описания у каждого
   элемента (`entity.overview`, 3–4 строки с line-clamp).
