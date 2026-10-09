# Промт для бэкенда: карточка произведения v2 и долги API

Фронтенд карточки готов (см. `docs/design.md`, `docs/architecture.md`), часть блоков ждёт API и
работает на заглушках или `localStorage`. Ниже — промт для новой сессии Claude Code, открытой в
`/home/dev/nexus_project`. Источник требований — `docs/backend-questions.md`; после реализации
пункты переезжают там в «Решено».

Что фронтенд включит, когда бэкенд будет готов, — в конце файла.

---

```
Проект Nexus — модульный монолит на Rust (axum 0.8, sqlx 0.8, PostgreSQL 18, utoipa, Meilisearch,
Redis). Перед работой прочитай: documents/for-other-modules.md (правила модулей, авторизация,
справочники, экстракторы, тесты, Definition of Done), documents/architecture.md (границы модулей,
«Чтение карточек и статика»), documents/modules/catalog.md и documents/modules/social.md.
Фронтенд (SvelteKit) лежит в /home/dev/nexus_web: его требования — docs/backend-questions.md,
как он читает поля — src/lib/catalog/card.ts, src/lib/social/*.ts. Код фронтенда не меняй.

Работаем в новой ветке feature/card-v2 от main. Один пункт — один коммит (или несколько), после
каждого — make ci зелёный. Порядок ниже — по зависимостям, не переставляй.

ОБЩИЕ ПРАВИЛА (не пересматривать):
- Изменения контрактов только ДОБАВОЧНЫЕ: новые поля, новые эндпоинты. Существующие поля не
  переименовывать и не удалять — фронтенд уже в продакшене. Новые поля в ответах — с
  #[serde(default)]/Option там, где их может не быть, и с примерами в #[schema(...)].
- Публичные списки (рецензии, сводка оценок, комментарии) остаются без токена и одинаковыми для
  всех: фронтенд грузит их без авторизации и они должны кэшироваться. Всё личное («мой голос»,
  «моя реакция», «моя отметка») — ОТДЕЛЬНЫМИ эндпоинтами с AuthUser, а не полями в публичных
  списках.
- Модули не лезут в чужие таблицы: social про сущности узнаёт через shared::directory
  (EntityDirectory), catalog про пользователей — через UserDirectory. Новый метод нужен —
  добавь в трейт и в реализацию у владельца.
- Карточка сущности — статика на фронтенде (SSG/ISR). Любая правка, меняющая GET
  /catalog/entities/{slug}, должна отправить publish (publish.rs) для КАЖДОЙ затронутой карточки.
- Каждый новый эндпоинт: #[utoipa::path] с ответами ошибок (shared::error::ErrorBody),
  операция с уникальным operation_id, тесты #[sqlx::test] (успех, 400, 401/403, 404, 409 где есть),
  запросы в http/<модуль>.http, UPDATE_OPENAPI=1 cargo test -p nexus openapi,
  documents/modules/<модуль>.md обновлён. Миграции — только новые файлы.
- Realtime: где сказано «событие» — публикуй в state.events так же, как уже публикуются
  review.* и thread.* (канал entity:<slug>), чтобы карточка у других зрителей перечиталась.

=== 0. Машинные коды ошибок (фундамент для пунктов ниже) ===
Тело ошибки: {"error": "...", "code": "snake_case_code"} — code добавочный, error остаётся.
- AppError получает необязательный код; ErrorBody в OpenAPI — поле code: Option<String>.
- Проставь коды существующим ошибкам, которые фронтенд сейчас распознаёт по тексту:
  email_not_verified, username_taken, email_taken, invalid_credentials, rate_limited,
  validation (общий 400), not_found, forbidden. Список итоговых кодов — в documents (таблица).
- Тест: несколько эндпоинтов отдают ожидаемый code.

=== 1. release_date в EntityRef ===
shared::directory::EntityRef — добавить release_date: Option<NaiveDate> (как в EntitySummary).
Реализация в catalog/src/directory.rs. Это попадёт в темы форума, рецензии профиля, коллекции —
фронтенд различит «Дюна (1984)» и «Дюна (2021)». Нужно и для пункта 3.

=== 2. Спойлеры в рецензиях ===
- Колонка reviews.is_spoiler boolean NOT NULL DEFAULT false.
- PutReview: is_spoiler: bool, по умолчанию false (старые клиенты не шлют).
- Review: is_spoiler: bool. Фронтенд уже размывает рецензию с is_spoiler = true.

=== 3. Оценки и рецензии только после премьеры ===
PUT /social/entities/{slug}/review для сущности с release_date в будущем (по UTC-дате сервера)
→ 409, code "not_released". Без даты — можно. Удалять свою рецензию можно всегда.

=== 4. Лайки и дизлайки рецензий ===
- Таблица review_votes(review_id FK ON DELETE CASCADE, user_id, value smallint CHECK (value IN
  (1,-1)), created_at; PK (review_id, user_id)).
- Счётчики в Review: likes_count, dislikes_count (i64) — денормализовать в reviews (колонки +
  обновление в той же транзакции), а не COUNT на каждый список.
- PUT /social/reviews/{id}/vote  body {value: 1 | -1} → 200 {likes_count, dislikes_count, value}.
  Повторный PUT с другим value — меняет голос. AuthUser. За свою рецензию — 403 code "own_review".
- DELETE /social/reviews/{id}/vote → 200 {likes_count, dislikes_count, value: null}; нет голоса — 200.
- GET /social/entities/{slug}/votes/mine (AuthUser) → {"<review_id>": 1 | -1, ...} — мои голоса
  за рецензии этой сущности (фронтенд берёт одним запросом на карточку).
- Удалённая рецензия (модерация, автором) — голоса уходят каскадом.

=== 5. Комментарии к рецензиям ===
- Таблица review_comments(id uuidv7, review_id FK CASCADE, author_id, body text 1..2000,
  created_at, updated_at, deleted_at NULL).
- В Review: comments_count (i64, денормализовано, без удалённых).
- GET /social/reviews/{id}/comments?limit&offset → Page<ReviewComment> по времени (старые
  сверху), публично. ReviewComment {id, author: UserRef, body, created_at, updated_at}.
- POST /social/reviews/{id}/comments {body} → 201 ReviewComment. AuthUser (любой вошедший).
  Пустой/длинный body → 400 code "validation". Рецензия без текста (только оценка) — 409
  code "review_without_text".
- DELETE /social/review-comments/{id} — автор комментария; admin — через
  /social/admin/review-comments/{id} (как модерация рецензий).
- Событие review.commented в entity:<slug>.
- Rate limit на POST — как у сообщений форума, если там есть.

=== 6. Реакции на произведение 🔥 😢 🤔 😴 ===
- Таблица entity_reactions(entity_id, user_id, kind text CHECK (kind IN
  ('fire','sad','think','bored')), created_at; PK (entity_id, user_id)) — одна реакция на зрителя.
- RatingSummary (GET /social/entities/{slug}/rating) — добавить reactions:
  {fire, sad, think, bored} (i64, всегда все четыре ключа).
- PUT /social/entities/{slug}/reaction {kind} → 200 {kind}; DELETE → 204;
  GET /social/entities/{slug}/reaction (AuthUser) → {kind} или 404 (как GET …/interest).
- До премьеры — тоже 409 "not_released" (как оценки).

=== 7. Отметки «Посмотреть позже» / «Просмотрено» ===
- Таблица entity_marks(entity_id, user_id, kind text CHECK (kind IN ('later','done')),
  created_at, updated_at; PK (entity_id, user_id)) — взаимоисключающие: одна строка на пару.
- PUT /social/entities/{slug}/mark {kind} → 200 {kind}; DELETE → 204;
  GET /social/entities/{slug}/mark (AuthUser) → {kind} или 404.
- GET /social/users/me/marks?kind=later|done&limit&offset (AuthUser) →
  Page<{entity: EntityRef, kind, created_at}>, свежие сверху — для будущего личного кабинета.
- Отметки приватные: чужие не отдаются никак.

=== 8. Приквелы, сиквелы, ремейки (catalog) ===
- Таблица entity_relations(from_id, to_id, kind text CHECK (kind IN ('sequel','remake')),
  position int, PK (from_id, to_id, kind), CHECK (from_id <> to_id)). Храним одно направление:
  to — сиквел (ремейк) from. Приквелы считаются обратным чтением sequel.
- EntityDetail (GET /catalog/entities/{slug}) — поле related:
  {prequels: EntitySummary[], sequels: EntitySummary[], remakes: EntitySummary[]}, каждая группа по
  release_date (NULLS LAST), пустые группы — []. remakes — в обе стороны (оригинал видит ремейки,
  ремейк видит оригинал). Фронтенд уже читает это поле: появится — раздел на карточке появится сам.
- Админка: PUT /catalog/admin/entities/{id}/relations {kind, to_id} и DELETE
  /catalog/admin/entities/{id}/relations/{to_id}?kind=…; запрет на связь с собой и дубликаты (409).
- Publish: правка связи меняет карточки ОБЕИХ сущностей — publish для обоих путей. Удаление
  сущности — связи каскадом и publish связанных.
- Сиды: dune-1984 ↔ dune-2021 как remake; если в сидах есть продолжение — sequel.

=== 9. Похожие / рекомендации (catalog) ===
GET /catalog/entities/{slug}/similar?limit=12 (1..24) → Page<EntitySummary>, публично.
Первая версия — без ML: тот же kind, больше общих тегов → выше (вес жанров ×2, см. пункт 10),
затем по release_date DESC; без самой сущности и без её related (они и так показаны рядом).
Один SQL с подсчётом пересечения тегов; индекс по entity_tags(tag_id) уже есть — проверь EXPLAIN.
Нет тегов — пустая страница (не 404). Фронтенд включит блок флагом.

=== 10. Жанры отдельно от тегов (catalog) ===
- tags.kind text NOT NULL DEFAULT 'tag' CHECK (kind IN ('genre','tag')).
- Tag в ответах — поле kind. EntityDetail.tags по-прежнему все теги сущности (не ломаем фронт),
  жанры первыми; фронтенд разделит по kind.
- Админка тегов: создание/правка с kind; GET /catalog/tags?kind=genre|tag.
- Миграция данных: сидовые жанровые теги (драма, фантастика, космическая опера, ужасы и т. п.)
  пометить genre — списком в миграции сидов, не эвристикой.
- Publish всех карточек с тегом при смене kind.

=== 11. Производство, награды, факты (catalog metadata) ===
В metadata (metadata.rs, validate):
- studios: string[] — фильмы и сериалы (у игр уже есть developer/publisher, у книг publisher);
  до 20, каждая 1..120 символов.
- awards: [{title: string 1..200, year: int 1880..2100 | null, won: bool}] — все типы, до 50.
- trivia: string[] — все типы, до 30, каждая 1..1000 символов.
Пустые массивы нормализовать в отсутствие поля, как остальные списки. Тесты validate.

=== 12. Долги API из docs/backend-questions.md фронтенда ===
a) GET /auth/admin/users: limit/offset — query, а не path (сейчас в OpenAPI in: path); ответ
   Page<UserView> с total; ?q= — поиск по username/email (ILIKE/pg_trgm).
b) GET /catalog/entities?sort=new|popular|rating|title — popular и rating без похода в social:
   либо денормализованные rating_average/rating_count в catalog, которые social обновляет через
   событие/трейт в shared, либо отложить popular/rating и сделать new|title (решение опиши в
   catalog.md; не нарушай границы модулей).
c) Оценка в списках: GET /social/ratings?slugs=a,b,c (до 100) → {"slug": {average, count}} —
   пакетно, публично.
d) GET /social/users/{username}/collections?contains={slug} → у каждой коллекции contains: bool.
e) Collection.preview: EntityRef[] — первые 4 пункта по порядку.
f) GET /catalog/tags/{slug} → Tag (с kind и entities_count).

Окно повтора refresh-токена уже сделано (27830bd) — не трогать.

В конце: documents/modules/*.md и documents/api/*.json обновлены, http/*.http дополнены,
make seed даёт данные для каждого нового блока (связи, жанры, studios/awards/trivia у dune-2021,
пара комментариев и голосов к рецензиям), make ci зелёный. Итоговым сообщением — список
эндпоинтов и полей с примерами JSON, чтобы фронтенд переключился с заглушек.
```

---

## Что фронтенд сделает после

| Пункт бэкенда                  | Что включаем на фронтенде                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0 коды ошибок                  | `errorMessage()` — перевод по `code` вместо сравнения строк                                                                          |
| 1 `release_date` в `EntityRef` | год в плашках тем, коллекций, рецензий профиля                                                                                       |
| 2 спойлеры                     | галочка «Есть спойлеры» в форме рецензии; `isSpoiler()` — по полю контракта                                                          |
| 3 до премьеры                  | сообщение по `code: not_released`                                                                                                    |
| 4 голоса                       | `review-votes.svelte.ts` → API (`votes/mine` на карточку), счётчики из `Review`                                                      |
| 5 комментарии                  | `REVIEW_COMMENTS_API = true`, загрузка и отправка в `ReviewComments`                                                                 |
| 6 реакции                      | `Reactions` → API, числа из `RatingSummary.reactions`                                                                                |
| 7 отметки                      | `marks.svelte.ts` → API; позже — списки в профиле                                                                                    |
| 8 связанные                    | ничего: раздел появится сам по полю `related`                                                                                        |
| 9 похожие                      | `RECOMMENDATIONS_API = true`                                                                                                         |
| 10 жанры                       | в шапке — жанры, над «О фильме» — теги (по `kind`)                                                                                   |
| 11 metadata                    | `Production` и форма админки — studios / awards / trivia                                                                             |
| 12 долги                       | админка пользователей с поиском, сортировки каталога, оценки в сетках, «В коллекцию» без N запросов, превью коллекций, страница тега |

После каждого слияния бэкенда: `pnpm api:types`, затем `pnpm verify`.
