/** Тематические пресеты оформления (баннеры, особые коллекции): градиент, акцент, узор. */

export type FeaturedThemeId =
	'default' | 'halloween' | 'romance' | 'new-year' | 'horror' | 'sci-fi' | 'family' | 'summer';

export type FeaturedTheme = {
	id: FeaturedThemeId;
	label: string;
	/** Классы фона (градиент на токенах daisyUI). */
	gradient: string;
	/** Акцент: кольцо и бейдж. */
	ring: string;
	badge: string;
	/** Необязательный декоративный CSS-узор (background-image), без эмодзи. */
	pattern?: string;
};

const dots = (c: string) => `radial-gradient(${c} 1.5px, transparent 1.5px) 0 0 / 18px 18px`;
const stripes = (c: string) =>
	`repeating-linear-gradient(135deg, ${c} 0 2px, transparent 2px 14px)`;

export const FEATURED_THEMES: readonly FeaturedTheme[] = [
	{
		id: 'default',
		label: 'Стандартная',
		gradient: 'from-primary/15 via-base-200 to-base-200',
		ring: 'ring-primary/60 hover:ring-primary',
		badge: 'badge-primary'
	},
	{
		id: 'halloween',
		label: 'Хеллоуин',
		gradient: 'from-warning/30 via-base-300 to-neutral/40',
		ring: 'ring-warning/70 hover:ring-warning',
		badge: 'badge-warning',
		pattern: stripes('color-mix(in oklab, var(--color-warning) 12%, transparent)')
	},
	{
		id: 'romance',
		label: 'Мелодрама',
		gradient: 'from-secondary/25 via-base-200 to-accent/15',
		ring: 'ring-secondary/60 hover:ring-secondary',
		badge: 'badge-secondary',
		pattern: dots('color-mix(in oklab, var(--color-secondary) 18%, transparent)')
	},
	{
		id: 'new-year',
		label: 'Новый год',
		gradient: 'from-info/25 via-base-200 to-success/15',
		ring: 'ring-info/60 hover:ring-info',
		badge: 'badge-info',
		pattern: dots('color-mix(in oklab, var(--color-info) 22%, transparent)')
	},
	{
		id: 'horror',
		label: 'Ужасы',
		gradient: 'from-error/25 via-base-300 to-neutral/50',
		ring: 'ring-error/60 hover:ring-error',
		badge: 'badge-error',
		pattern: stripes('color-mix(in oklab, var(--color-error) 10%, transparent)')
	},
	{
		id: 'sci-fi',
		label: 'Фантастика',
		gradient: 'from-accent/25 via-base-200 to-info/20',
		ring: 'ring-accent/60 hover:ring-accent',
		badge: 'badge-accent',
		pattern: stripes('color-mix(in oklab, var(--color-accent) 10%, transparent)')
	},
	{
		id: 'family',
		label: 'Семейное',
		gradient: 'from-success/20 via-base-200 to-warning/15',
		ring: 'ring-success/60 hover:ring-success',
		badge: 'badge-success'
	},
	{
		id: 'summer',
		label: 'Лето',
		gradient: 'from-warning/20 via-base-200 to-info/15',
		ring: 'ring-warning/60 hover:ring-warning',
		badge: 'badge-warning',
		pattern: dots('color-mix(in oklab, var(--color-warning) 18%, transparent)')
	}
];

const BY_ID = new Map(FEATURED_THEMES.map((t) => [t.id, t]));
export const DEFAULT_THEME = BY_ID.get('default')!;
