// Что выдача уже показывала во вкладке. Нужно для возврата с карточки: адрес помнит число
// догруженных порций (?more=), но перезапрашивать их все — лишние запросы и мигание короткого
// списка. Память живёт до перезагрузки; нет её — страница просто догрузит выдачу сама.
import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
import type { Ratings } from './load.ts';
import { feedKey, type UrlLike } from './url.ts';

export interface Shown {
	items: SchemaEntitySummary[];
	/** Всего в выдаче по ответу бэкенда. */
	total: number;
	/** offset следующей порции. */
	next: number;
	/** Выдача кончилась. */
	done: boolean;
	ratings: Ratings;
}

/** Сколько последних выдач помним: хватает на «ушёл с одной, вернулся», без роста памяти. */
const LIMIT = 3;

const feeds = new Map<string, Shown>();

/** Запомнить показанное этой выдачей (ключ — feedKey из url.ts). */
export function keepShown(key: string, shown: Shown): void {
	feeds.delete(key);
	feeds.set(key, shown);
	for (const old of [...feeds.keys()].slice(0, -LIMIT)) feeds.delete(old);
}

/** Что выдача показывала в прошлый раз, если вкладка это помнит. */
export function shown(key: string): Shown | null {
	return feeds.get(key) ?? null;
}

/**
 * Адрес выдачи так, как он сейчас в строке браузера: «Показать ещё» правит его неглубокой
 * навигацией, и до load доходит адрес без `?more=`. Берём строку браузера, только если это та же
 * выдача (путь и фильтры совпадают), иначе — при переходе на другую выдачу — адрес из load.
 */
export function shownUrl(url: UrlLike): UrlLike {
	// На сервере строки браузера нет — там адрес из load и есть настоящий.
	if (typeof location === 'undefined') return url;
	const here = new URL(location.href);
	return feedKey(here) === feedKey(url) ? here : url;
}
