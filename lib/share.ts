export type LetterState = 'correct' | 'present' | 'absent';

export function buildWordShareText(params: {
	dayNumber: number;
	evaluations: LetterState[][];
	won: boolean;
	score: number;
	playerName?: string | null;
	streak?: number;
	appUrl: string;
}) {
	const { dayNumber, evaluations, won, score, playerName, streak, appUrl } = params;
	const attemptsText = won ? `${evaluations.length}/6` : 'X/6';
	const displayPlayer = playerName?.trim() || 'Invitado';
	const streakBadge = streak && streak > 0 ? ` · 🔥 ${streak}` : '';

	const grid = evaluations
		.map((row) =>
			row
				.map((s) => (s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛'))
				.join('')
		)
		.join('\n');

	return [
		`FrateWordleSquad · Día ${dayNumber} · ${attemptsText} (${score} pts)`,
		`👤 ${displayPlayer}${streakBadge}`,
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
	playerName?: string | null;
	streak?: number;
	appUrl: string;
}) {
	const { dayNumber, wrongCount, won, score, playerName, streak, appUrl } = params;
	const hearts = Array.from({ length: 6 }, (_, i) => (i < 6 - wrongCount ? '🟩' : '🟥')).join('');
	const resultText = won ? `Resuelto (${wrongCount} fallos)` : 'Ahorcado (6/6)';
	const displayPlayer = playerName?.trim() || 'Invitado';
	const streakBadge = streak && streak > 0 ? ` · 🔥 ${streak}` : '';

	return [
		`Frate Frase · Día ${dayNumber} - ${resultText} (${score} pts)`,
		`👤 ${displayPlayer}${streakBadge}`,
		hearts,
		'',
		`Juega hoy: ${appUrl}`
	].join('\n');
}