# Документация Nexus Web

| Документ                                                       | О чём                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [architecture.md](architecture.md)                             | Стек, структура кода и маршрутов, SSR, API-клиент и генерация типов           |
| [auth.md](auth.md)                                             | Вход, токены и очередь обновления, защита страниц, страницы для писем и OAuth |
| [design.md](design.md)                                         | Ориентиры по внешнему виду и правила вёрстки                                  |
| [backend-questions.md](backend-questions.md)                   | Чего не хватает в API и что исправить в контрактах бэкенда                    |
| [backend-prompt-meilisearch.md](backend-prompt-meilisearch.md) | Задача бэкенду: всё для списков каталога — в Meilisearch                      |

Продукт и API описаны в бэкенде: `../nexus_project/documents/` (vision, модули, OpenAPI).
Живой Swagger: http://localhost/docs.

## Правила

- Приняли решение, которое не видно из кода, — допишите его сюда с объяснением «почему».
- Нашли, чего не хватает в API, — в [backend-questions.md](backend-questions.md), код бэкенда
  отсюда не меняем.
- **Любая сортировка, фильтрация и поиск — только через Meilisearch** (`GET /search`,
  `GET /search/people`), не через PostgreSQL (`GET /entities` со списками, `?q=` по БД): из БД
  список каталога на dev шёл 6–8 с, из Meilisearch — десятки миллисекунд. Чего нет в индексе —
  не обходим через БД, а ставим задачу бэкенду добавить это в Meilisearch
  ([backend-prompt-meilisearch.md](backend-prompt-meilisearch.md)). Из БД — только одна запись по
  slug (карточка, тег, студия) и служебный обход каталога при сборке и в ISR.
