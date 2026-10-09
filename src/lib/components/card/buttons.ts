// Кнопки шапки карточки — один стиль на все: одна главная (оранжевая, «Оценить») и спокойные
// «стеклянные» — полупрозрачные круглые пилюли, которые смотрятся и поверх трейлера, и на фоне.
// Классы целиком — чтобы Tailwind их нашёл.

/** Главное действие. */
export const HERO_PRIMARY =
	'btn btn-primary rounded-full px-5 shadow-md shadow-primary/25 hover:shadow-primary/40';

/** Второстепенное действие с подписью. */
export const HERO_GLASS =
	'btn rounded-full border-base-content/10 bg-base-content/5 px-4 font-semibold backdrop-blur-md hover:border-base-content/25 hover:bg-base-content/10';

/** Круглая кнопка-иконка того же стиля. */
export const HERO_ICON =
	'btn btn-circle border-base-content/10 bg-base-content/5 backdrop-blur-md hover:border-base-content/25 hover:bg-base-content/10';

/** Та же иконка во включённом состоянии («Вы следите»). */
export const HERO_ICON_ON =
	'btn btn-circle border-primary/40 bg-primary/15 text-primary backdrop-blur-md hover:border-primary/60 hover:bg-primary/25';
