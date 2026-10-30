<script lang="ts">
	import Seo from '#lib/components/catalog/Seo.svelte';

	// Страница о приложении: что это, куда писать и кто делает — по возможности коротко.
	// Почта и ссылки на создателей пока тестовые — заменить на настоящие перед релизом.
	const VERSION = '0.0.1';
	const EMAIL = 'test@gmail.com';

	const bug = `mailto:${EMAIL}?subject=${encodeURIComponent('Кассандра: ошибка')}`;
	const idea = `mailto:${EMAIL}?subject=${encodeURIComponent('Кассандра: предложение')}`;

	const plans = [
		{
			title: 'Порядок в данных',
			now: true,
			text: 'Сейчас ошибок много: нет постеров, встречаются неверные сведения. Это важнее всего остального — каталог без точных данных бессмысленен.'
		},
		{
			title: 'Нейросеть-собеседник',
			text: 'Не краткий пересказ, а разбор: что произведение значит и почему сделано именно так. Личный преподаватель, а не аннотация.'
		},
		{
			title: 'Свой поиск на Tantivy',
			text: 'Переход с Meilisearch на Tantivy — поисковый движок и хранилище на Rust: быстрее и гибче под наши фильтры.'
		},
		{
			title: 'Интеграции',
			text: 'Telegram и Obsidian: заметки и обсуждения там, где вы уже пишете.'
		},
		{ title: 'Нативные приложения', text: 'Отдельные приложения вместо сайта в браузере.' }
	];

	const authors = [
		{
			name: 'Антон',
			role: 'Идея, разработка',
			links: [
				{ title: 'Telegram', href: 'https://example.com' },
				{ title: 'GitHub', href: 'https://example.com' }
			]
		}
	];
</script>

<Seo
	title="О приложении"
	description="Кассандра — каталог фильмов, сериалов, книг, игр и картин: миллионы произведений, рецензии, коллекции и обсуждения."
/>

<article class="mx-auto max-w-3xl py-4">
	<header class="border-b border-base-300 pb-8">
		<div class="flex flex-wrap items-baseline gap-x-4 gap-y-2">
			<h1 class="text-4xl font-black tracking-widest uppercase sm:text-5xl">Кассандра</h1>
			<span class="font-mono text-xs text-primary">v{VERSION}</span>
		</div>
		<p class="mt-5 text-xl leading-snug font-medium text-balance sm:text-2xl">
			<span class="text-primary">Миллионы</span> фильмов, сериалов, книг, игр и картин — и люди, которым
			они важны так же, как вам.
		</p>
	</header>

	<!-- Обратная связь — сразу под заголовком: ради неё страницу и открывают. -->
	<section
		class="mt-8 rounded-box border border-primary/20 bg-base-200 bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_oklch,var(--color-primary)_10%,transparent),transparent_60%)] p-5 sm:p-6"
	>
		<h2 class="text-lg font-bold text-balance">Нашли ошибку или знаете, чего не хватает?</h2>
		<p class="mt-1 text-sm text-base-content/60">
			Предложения тех, кто пользуется Кассандрой, определяют, что появится дальше.
		</p>
		<div class="mt-5 flex flex-wrap items-center gap-2">
			<a href={bug} class="btn rounded-full btn-primary btn-sm">Сообщить об ошибке</a>
			<a
				href={idea}
				class="btn rounded-full border-base-content/10 bg-base-content/5 backdrop-blur btn-sm"
				>Предложить функцию</a
			>
			<a
				href="mailto:{EMAIL}"
				class="ml-auto link font-mono text-xs text-base-content/40 link-hover">{EMAIL}</a
			>
		</div>
	</section>

	<section class="mt-12 space-y-4 text-base-content/70">
		<h2 class="flex items-center gap-3 text-xs tracking-widest text-base-content/40 uppercase">
			Зачем это
			<span class="h-px flex-1 bg-base-300" aria-hidden="true"></span>
		</h2>
		<p>
			Один каталог вместо десятка сайтов: оценки, рецензии, коллекции и обсуждения лежат рядом с
			самими произведениями. Но ценность не в списке, а в людях вокруг него — что посмотреть дальше
			и с кем обсудить прочитанное.
		</p>
		<p>
			Дальше — нейросетевое общение: понять смысл произведения, а не пересказ сюжета, и докопаться
			до сути вместе с теми, кому это тоже важно.
		</p>
	</section>

	<!-- Планы — по порядку работы: первым идёт то, чем занимаемся прямо сейчас. -->
	<section class="mt-12">
		<h2 class="flex items-center gap-3 text-xs tracking-widest text-base-content/40 uppercase">
			Планы
			<span class="h-px flex-1 bg-base-300" aria-hidden="true"></span>
		</h2>
		<!-- Дорожка слева: номер шага на линии, текущий шаг подсвечен. -->
		<ol class="mt-5 ml-3 border-l border-base-300">
			{#each plans as p, i (p.title)}
				<li class="relative py-4 pl-7">
					<span
						class={[
							'absolute top-4.5 -left-3 grid size-6 place-items-center rounded-full font-mono text-[0.65rem] ring-4 ring-base-100',
							p.now ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content/50'
						]}
						aria-hidden="true">{i + 1}</span
					>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h3 class={['font-semibold', p.now && 'text-primary']}>{p.title}</h3>
						{#if p.now}
							<span class="badge badge-soft badge-xs badge-primary">Сейчас</span>
						{/if}
					</div>
					<p class="mt-1 max-w-xl text-sm text-base-content/50">{p.text}</p>
				</li>
			{/each}
		</ol>
	</section>

	<section class="mt-12">
		<h2 class="flex items-center gap-3 text-xs tracking-widest text-base-content/40 uppercase">
			Кто делает
			<span class="h-px flex-1 bg-base-300" aria-hidden="true"></span>
		</h2>
		<ul class="mt-4 divide-y divide-base-300">
			{#each authors as a (a.name)}
				<li class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
					<span
						class="grid size-9 place-items-center rounded-full bg-base-300 font-bold text-base-content/70"
						aria-hidden="true">{a.name.slice(0, 1)}</span
					>
					<span class="font-bold">{a.name}</span>
					<span class="text-sm text-base-content/50">{a.role}</span>
					<span class="ml-auto flex gap-x-4 text-sm">
						{#each a.links as l (l.title)}
							<a href={l.href} class="link link-hover" rel="noopener external">{l.title}</a>
						{/each}
					</span>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Юридическое нужно, но читают его редко — прячем в раскрывашку. -->
	<section class="mt-10 mb-4">
		<div class="collapse-arrow collapse border border-base-300">
			<input type="checkbox" />
			<div class="collapse-title text-sm font-medium">Правовая информация</div>
			<div class="collapse-content space-y-3 text-sm text-base-content/50">
				<p>
					Кассандра — некоммерческий справочный проект. Сервис не хранит и не раздаёт фильмы, книги
					и игры: только сведения о них, оценки и тексты пользователей.
				</p>
				<p>
					Постеры, обложки и описания принадлежат правообладателям и используются в справочных
					целях. Часть данных предоставлена <a
						href="https://www.themoviedb.org/"
						class="link link-hover"
						rel="noopener external">TMDB</a
					>. Если материал размещён с нарушением ваших прав, напишите на
					<a href="mailto:{EMAIL}" class="link link-hover">{EMAIL}</a> — снимем.
				</p>
				<p>
					Рецензии, обсуждения и коллекции остаются за их авторами. Регистрируясь, вы соглашаетесь
					не публиковать запрещённое законом и оскорбительное.
				</p>
			</div>
		</div>
	</section>
</article>
