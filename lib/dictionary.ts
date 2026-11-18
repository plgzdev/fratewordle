import spanishWords from 'an-array-of-spanish-words';

export function normalizeSpanish(text: string): string {
	return text
		.trim()
		.toUpperCase()
		.replace(/Á/g, 'A')
		.replace(/É/g, 'E')
		.replace(/Í/g, 'I')
		.replace(/Ó/g, 'O')
		.replace(/Ú/g, 'U')
		.replace(/Ü/g, 'U');
}

const VALID_WORDS_SET = new Set(
	(spanishWords as string[]).map((w) => normalizeSpanish(w))
);

export function isValidSpanishWord(word: string, expectedLength: number): boolean {
	const clean = normalizeSpanish(word);
	if (clean.length !== expectedLength) return false;
	return VALID_WORDS_SET.has(clean);
}

export function getLocalTodayStr(): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Caracas',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
}