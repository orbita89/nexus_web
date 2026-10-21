# Особые коллекции: обложка и тема (задача бэкенду)

Особые коллекции создаёт только админ, поэтому оформление тоже задаёт админ: своя обложка
(например, к Хеллоуину) или тематический пресет (мелодрама, Новый год…).

## Поля Collection

Во **всех** ответах с Collection / CollectionDetail (список, деталь, `collections/featured`,
профиль, preview):

- `cover_url: string | null` — обложка, заданная админом (https-URL или результат загрузки
  через существующий upload/media). Рекомендуемое соотношение 16:9, ≥1280px по ширине.
- `theme: string | null` — id пресета. Строка без enum на уровне БД; допустимые сейчас:
  `default, halloween, romance, new-year, horror, sci-fi, family, summer`
  (фронт: `src/lib/social/featuredThemes.ts`; неизвестное значение фронт игнорирует).

Для не-особых коллекций поля всегда `null`.

## Эндпоинт

`PATCH /api/v1/social/admin/collections/{id}/featured` (роль admin), тело — все поля необязательны:

```json
{ "position": 3, "cover_url": "https://…", "theme": "halloween" }
```

- `cover_url`: `null` — сбросить; иначе https-URL ≤ 2048 символов или id загруженного файла.
- `theme`: `null` — сбросить; строка `^[a-z0-9-]{1,32}$`.
- Коллекция должна быть особой, иначе 409 `code: "not_featured"`.
- Ответ — обновлённая Collection.

## Ошибки

У 400 сейчас нет машинного кода — фронт отличает «коллекция приватная» по тексту.
Просьба: `code: "collection_private"` для приватной, `code: "validation"` с полем для
cover_url/theme.

## Фронт после реализации

Перегенерировать `src/lib/api/generated/social.ts`, включить
`FEATURED_STYLE_SUPPORTED` в `featuredThemes.ts`, дописать вызов сохранения в
`FeaturedAdminControls.svelte`.
