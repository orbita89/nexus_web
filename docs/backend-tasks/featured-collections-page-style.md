# Особые коллекции: гибкое оформление страницы

Сейчас обои (`wallpaper_url`) — только фон шапки `/collections/{slug}`, остальная страница чёрная.
Нужно: обои/тема на всю страницу (например, ужастик → капли крови по фону), настройки затемнения/размытия,
выключатель декоративных эффектов и свой акцентный цвет.

## Новые поля Collection

Возвращаются в **каждом** ответе с Collection (списки, детальная, featured, admin), сбрасываются в дефолт при снятии «особости» (как `wallpaper_url`/`cover_url`/`theme`).

| Поле             | Тип                  | Дефолт     | Смысл                                                            |
| ---------------- | -------------------- | ---------- | ---------------------------------------------------------------- |
| `wallpaper_mode` | `"header" \| "page"` | `"header"` | Обои только в шапке или фоном всей страницы.                     |
| `wallpaper_dim`  | `integer` 0–100      | `null`     | Затемнение обоев, %. `null` — фронт берёт своё значение по теме. |
| `wallpaper_blur` | `integer` 0–20       | `0`        | Размытие обоев, px.                                              |
| `effects`        | `boolean`            | `true`     | Декоративные эффекты темы (капли крови, снег и т.п.) вкл/выкл.   |
| `accent_color`   | `string \| null`     | `null`     | Свой акцент `#rrggbb` поверх цвета темы. `null` — цвет темы.     |

## API

`PUT /api/v1/social/admin/collections/{id}/featured` — те же семантики, что у `wallpaper_url`/`theme`:
поле не передано — не меняется, `null` — сброс в дефолт.

```json
{
	"theme": "horror",
	"wallpaper_mode": "page",
	"wallpaper_dim": 60,
	"wallpaper_blur": 4,
	"effects": true,
	"accent_color": "#b3001b"
}
```

Ответ — обновлённая Collection.

### Валидация (400 `code: "validation"`, `field: "<имя>"`)

- `wallpaper_mode` ∉ {`header`, `page`};
- `wallpaper_dim` не целое или вне 0–100; `wallpaper_blur` не целое или вне 0–20;
- `effects` не boolean (`null` = сброс в `true`);
- `accent_color` не `^#[0-9a-f]{6}$` (регистр нормализовать в нижний).

Остальные ошибки — как сейчас (403/404/409 `not_featured`). Обновить `documents/api/social.json`.

## Фронт после реализации

1. Перегенерировать `src/lib/api/generated/catalog.ts`.
2. `FeaturedStyleForm.svelte`: переключатель «Обои: шапка / вся страница», слайдеры «Затемнение», «Размытие», чекбокс «Эффекты темы», выбор акцентного цвета со сбросом.
3. `FeaturedCollectionView.svelte` / `routes/collections/[id]/+page.svelte`: при `page` — фиксированный фон на всю страницу с dim/blur; слой эффектов темы (капли крови для `horror` и т.п.) при `effects`; `accent_color` → CSS-переменная акцента.
4. `src/lib/social/featuredThemes.ts`: дефолтный dim и эффекты для тем (добавлять только аддитивно, `themes.ts` общий с баннерами).
