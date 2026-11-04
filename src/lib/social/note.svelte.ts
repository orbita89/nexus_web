// Одно состояние заметки на страницу карточки: открыть её редактор может и сам блок, и панель
// «Оценить» в шапке — там пункт «Заметка» рядом с «Написать рецензию». Так же устроена рецензия
// (MyReviewState.composing), только у заметки состояние проще: открыт редактор или нет.
class NoteComposer {
	open = $state(false);
}

export const noteComposer = new NoteComposer();

/** Открыть редактор заметки и пролистать к нему: вызывается из шапки карточки. */
export function openNote() {
	noteComposer.open = true;
	document.getElementById('note')?.scrollIntoView({
		behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
		block: 'center'
	});
}
