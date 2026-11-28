import { publicApi } from '#lib/api/client.ts';
import { orError } from '#lib/catalog/load.ts';
import { peopleList } from '#lib/catalog/people.ts';
import type { PageServerLoad } from './$types';

// /people — статика: «Популярные люди» без поиска и роли. HTML и __data.json на диске
// (people.html, people/__data.json — server/isr.js), отдаёт nginx. Перерисовываются по таймеру
// (ISR_PEOPLE_REFRESH_SEC, известность меняется медленно) и из админки (группа «Люди»).
//
// Адрес не читаем: nginx отдаёт файл без учёта query. Поиск (?q=) и вкладку роли (?role=) страница
// грузит в браузере из Tantivy. orError, а не ошибка на странице: сбой поиска не попадёт в статику.
export const prerender = 'auto';

export const load: PageServerLoad = async ({ fetch, url }) => ({
	list: await orError(peopleList(publicApi(fetch, url)))
});
