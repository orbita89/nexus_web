# Обсуждение коллекций (задача бэкенду)

Сейчас у коллекций нет комментариев: есть только обсуждения, привязанные к
произведениям, и комментарии к рецензиям (`/reviews/{id}/comments`). Нужно
обсуждение под коллекцией (в первую очередь — под особыми подборками).

API повторяет форму комментариев к рецензиям, чтобы фронт переиспользовал
паттерны `ReviewComments.svelte`.

## Схемы

`CollectionComment` (по образцу `ReviewComment`):

| поле            | тип          | примечание                                  |
| --------------- | ------------ | ------------------------------------------- |
| `id`            | uuid         |                                             |
| `collection_id` | uuid         |                                             |
| `parent_id`     | uuid \| null | ответ на комментарий, один уровень вложения |
| `author`        | `UserRef`    |                                             |
| `body`          | string       |                                             |
| `created_at`    | date-time    |                                             |
| `updated_at`    | date-time    |                                             |

`CreateCollectionComment`: `{ body: string, parent_id?: uuid | null }`,
`additionalProperties: false`.

`Page_CollectionComment`: `{ items, total, limit, offset }` — как `Page_ReviewComment`.

В `Collection` / `CollectionDetail` добавить `comments_count: integer`
(во всех ответах: список, детальная, `/collections/featured`, by-slug, лента).

## Эндпоинты

### GET /api/v1/social/collections/{id}/comments

- Публичный (гость видит обсуждение публичной коллекции; приватную — только владелец).
- `limit` (1–100, по умолчанию 20), `offset`.
- Порядок: **старые сверху** (по `created_at`, затем `id`). Как у комментариев
  к рецензиям: обсуждение читается как разговор, ответы идут после того, на что
  отвечают, и при дозагрузке новые просто дописываются в конец — смещения не
  «съезжают», когда кто-то пишет во время чтения.
- Ответы (`parent_id`) приходят в той же ленте плоско; фронт группирует их под
  родителем. Альтернатива — отдавать только корневые с вложенными `replies`
  (решите на бэкенде, сообщите).
- Ошибки: 400 (некорректные limit/offset), 404 (нет коллекции или она приватная чужая).

### POST /api/v1/social/collections/{id}/comments

- Только авторизованный. Тело `CreateCollectionComment`.
- `body` — 1–2000 символов после trim.
- `parent_id` — комментарий этой же коллекции и сам корневой (иначе 400,
  `field: parent_id`). Ответ на ответ — привязать к его корню или 400 (выберите).
- Rate limit: например, не больше 5 комментариев в минуту на пользователя → 429
  с `Retry-After`.
- Ответ 201 — созданный `CollectionComment`.
- Ошибки: 400 (валидация, в `ErrorBody` поле `field`: `body` / `parent_id`),
  401, 403 (пользователь заблокирован / обсуждение закрыто — `code: comments_locked`),
  404 (коллекции нет или она недоступна), 429.

### DELETE /api/v1/social/collection-comments/{id}

- Автор удаляет свой комментарий. 204; 401, 403 (чужой), 404.
- Удаление комментария с ответами: ответы удаляются вместе с ним или остаются
  с телом «Комментарий удалён» — выберите и опишите.

### DELETE /api/v1/social/admin/collection-comments/{id}

- Модерация, как `/admin/review-comments/{id}`. 204; 401, 403, 404.

### Закрытие обсуждения (опционально)

Флаг `comments_locked: boolean` у коллекции (меняет владелец/админ). При
закрытом обсуждении GET работает, POST — 403 `comments_locked`.

## Realtime

У комментариев к рецензиям realtime-событий нет (на фронте нет подписки), поэтому
на первом этапе не нужно. Если будет — событие `collection_comment.created`
в канал коллекции с полным `CollectionComment`.

## Фронт после реализации

- Перегенерировать `src/lib/api/generated/social.ts`.
- `src/lib/social/collectionComments.ts` — list/create/delete по образцу рецензий.
- Компонент обсуждения по образцу `ReviewComments.svelte` (дозагрузка, оптимистичная
  отправка, удаление своего, ответ одного уровня) внизу `FeaturedCollectionView.svelte`
  и страницы обычной коллекции.
- Счётчик `comments_count` на `FeaturedCollectionCard` / `CollectionCard`.
- Админ: кнопка удаления чужого комментария.
