# Промт для бэкенда: раздел «Награды»

Фронтенд наград как сущности сейчас не имеет: в `EntityDetail.metadata.awards` лежит плоский
список строк (`title`, `year`, `won`), которого хватает только на текстовые строчки в блоке
«Производство и факты». Полный разбор модели и экранов — `docs/backend-tasks/awards.md`.
Ниже — промт для новой сессии Claude Code, открытой в `/home/dev/nexus_project`.

---

```
Проект Nexus — модульный монолит на Rust (axum 0.8, sqlx 0.8, PostgreSQL 18, utoipa, Meilisearch,
Redis). Перед работой прочитай: documents/for-other-modules.md (правила модулей, авторизация,
справочники, экстракторы, тесты, Definition of Done), documents/architecture.md (границы модулей,
«Чтение карточек и статика»), documents/modules/catalog.md.
Фронтенд (SvelteKit) лежит в /home/dev/nexus_web: подробная постановка с таблицами полей —
docs/backend-tasks/awards.md, как фронт читает карточку — src/lib/catalog/card.ts.
Код фронтенда не меняй.

Работаем в новой ветке feature/awards от main. Один пункт — один коммит (или несколько), после
каждого — make ci зелёный. Порядок ниже — по зависимостям, не переставляй.

ОБЩИЕ ПРАВИЛА (не пересматривать):
- Изменения контрактов только ДОБАВОЧНЫЕ: metadata.awards у сущностей остаётся как есть, пока
  контент не переедет на новую модель. Существующие поля не переименовывать и не удалять.
- Всё публичное (списки премий, церемонии, номинации) — без токена, одинаково для всех,
  кэшируемо (s-maxage=600). Админские правки — отдельные эндпоинты под /admin.
- Награды живут в модуле catalog. О людях и работах модуль знает через свои таблицы entities и
  people; в social не лезть.
- Карточка сущности — статика (SSG/ISR). Любая правка номинаций, меняющая GET
  /catalog/entities/{slug} или профиль человека, обязана отправить publish (publish.rs) для
  КАЖДОЙ затронутой карточки.
- Каждый новый эндпоинт: #[utoipa::path] с ошибками (shared::error::ErrorBody), уникальный
  operation_id, тесты #[sqlx::test] (успех, 400, 401/403, 404, 409 где есть), запросы в
  http/catalog.http, UPDATE_OPENAPI=1 cargo test -p nexus openapi, documents/modules/catalog.md
  обновлён. Миграции — только новые файлы.

=== 1. Схема ===
Четыре таблицы (точные колонки, ключи и CHECK — в docs/backend-tasks/awards.md фронтенда):
- awards: id, slug (unique), title, full_title, kinds text[] (movie|series|book|game — премия
  может покрывать несколько типов, напр. «Золотой глобус»), country, founded, description,
  logo_url, site_url, position.
- award_editions: id, award_id FK CASCADE, year (1880–2100), number, held_on, place, cover_url,
  season_year (год работ, если отличается от года церемонии: Оскар 2024 — за 2023-й).
  Unique (award_id, year).
- award_categories: id, award_id FK CASCADE, slug, title, position. Unique (award_id, slug).
  Категории принадлежат премии, а не церемонии; что было в конкретном году — видно по
  номинациям. Переименование в конкретном году — title_override в номинации.
- award_nominations: id, edition_id FK CASCADE, category_id FK RESTRICT, entity_id FK entities
  NULL, person_id FK people NULL, name NULL, role, won bool default false, position.
  CHECK: заполнено хотя бы одно из entity_id / person_id / name. Актёрская номинация — это и
  работа, и человек сразу (оба FK). Победителей в категории может быть несколько, поэтому won —
  флаг номинации, а не winner_id в категории.
Индексы под выборки: (award_id, year desc) по церемониям, (edition_id, category_id, position) и
(entity_id), (person_id) по номинациям.

=== 2. Публичное чтение ===
Под GET /api/v1/catalog/awards, гостю доступно, s-maxage=600:
- GET /awards?kind=&q=&page=&per_page= → { items: Award[], total }. kind фильтрует по kinds
  (это вкладки раздела на фронте), q — поиск по названию. В элементе списка нужны
  editions_count и latest_year (на плитке премии пишем «1929–2024»).
- GET /awards/{slug} → AwardDetail: поля премии + editions: AwardEditionBrief[] (year, number,
  held_on, cover_url, nominations_count, top: EntityRef[] — 3–5 победителей главной категории
  для превью), годы по убыванию.
- GET /awards/{slug}/{year} → AwardEditionDetail: церемония + categories[], каждая
  { slug, title, position, nominations[] }, номинации отсортированы, победители первыми.
  В Nomination: entity: EntitySummary|null (обязательно slug, cover_url, release_date — фронту
  нужен постер), person: PersonRef|null (slug, name, photo_url), name, role, won.
  Нет такой церемонии — 404.

=== 3. Обратная сторона: награды у работы и человека ===
- В EntityDetail добавить awards: EntityAward[], где EntityAward =
  { award: { slug, title, logo_url }, year, category: { slug, title }, role, won }.
  Старое metadata.awards не трогать — фронт покажет новое поле, если оно непустое.
- То же поле в PersonDetail.
- Обе правки меняют статику → publish для затронутых карточек при любом изменении номинаций.

=== 4. Meilisearch ===
В документ работы добавить и настроить: award_slugs string[] (фильтруемое),
award_wins int и award_nominations int (фильтруемые и сортируемые), award_years int[]
(фильтруемое). Переиндексация — при изменении номинаций. Без этого фронт не сможет сделать
фильтр «есть награда» и сортировку по числу наград: любые выборки каталога у нас идут только
через индекс.

=== 5. Админка ===
Под /api/v1/catalog/admin/awards, не админ — 403, ответ — изменённый объект:
- POST /awards, PATCH /awards/{slug}, DELETE /awards/{slug} (каскад сносит церемонии и
  номинации — требовать ?force=true, иначе 409, если номинации есть);
- POST|PATCH|DELETE /awards/{slug}/editions/{year};
- POST|PATCH|DELETE /awards/{slug}/categories/{category_slug};
- PUT /awards/{slug}/{year}/nominations — заменить церемонию целиком, тело
  { categories: [{ slug, nominations: [...] }] } (основной путь для импорта);
- POST|PATCH|DELETE одной номинации — для точечных правок.
Логотип и обложка — через существующую загрузку картинок, в полях только URL.

=== 6. Данные ===
Импорт исторических церемоний (Оскар с 1929-го — тысячи строк) сделать отдельной командой на
стороне бэкенда поверх PUT-а целиком. На старте достаточно залить по одной крупной премии на тип:
Оскар (movie), Эмми (series), Хьюго (book), The Game Awards (game) — хотя бы за последние 5 лет,
чтобы раздел не открывался пустым.

ГОТОВО, когда: make ci зелёный, OpenAPI обновлён, documents/modules/catalog.md описывает модель и
эндпоинты, в documents/api/catalog.json есть все новые схемы (фронт перегенерирует типы через
pnpm api:types), и GET /awards?kind=movie, /awards/oscar, /awards/oscar/2024 отдают реальные
данные.
```

---

## Что фронтенд включит после

- вкладку «Награды» в шапке (рядом с «Люди» и «Коллекции»);
- `/awards` — вкладки по типам работ и плитки премий;
- `/awards/{slug}` — премия и сетка годов;
- `/awards/{slug}/{year}` — категории, победитель крупно (постер работы или фото человека),
  остальные номинанты строками;
- блок «Награды» на карточке работы и в профиле человека — ссылками на церемонии;
- фильтр «есть награда» и сортировку по числу наград в каталоге — на фасетах Meilisearch.
