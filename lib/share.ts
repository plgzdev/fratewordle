export type LetterState = 'correct' | 'present' | 'absent';

export function buildWordShareText(params: {
	dayNumber: number;
	evaluations: LetterState[][];
	won: boolean;
	score: number;
	appUrl: string;
}) {
	const { dayNumber, evaluations, won, score, appUrl } = params;
	const attemptsText = won ? `${evaluations.length}/6` : 'X/6';

	const grid = evaluations
		.map((row) =>
			row
				.map((s) => (s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛'))
				.join('')
		)
		.join('\n');

	return [
		`FrateWordleSquad #${dayNumber} ${attemptsText} (${score} pts)`,
		'',
		grid,
		'',
		`Juega hoy: ${appUrl}`
	].join('\n');
}

export function buildPhraseShareText(params: {
	dayNumber: number;
	wrongCount: number;
	won: boolean;
	score: number;
	appUrl: string;
}) {
	const { dayNumber, wrongCount, won, score, appUrl } = params;
	const hearts = Array.from({ length: 6 }, (_, i) => (i < 6 - wrongCount ? '🟩' : '🟥')).join('');
	const resultText = won ? `Resuelto (${wrongCount} fallos)` : 'Ahorcado (6/6)';

	return [
		`Frate Frase #${dayNumber} - ${resultText} (${score} pts)`,
		hearts,
		'',
		`Juega hoy: ${appUrl}`
	].join('\n');
}