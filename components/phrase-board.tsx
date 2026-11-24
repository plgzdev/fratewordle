'use client';

interface PhraseBoardProps {
	maskedChars: string[];
	wrongLetters: string[];
	hint: string | null;
	status?: 'playing' | 'won' | 'lost';
}

const MAX_MISTAKES = 6;

export function PhraseBoard({
	maskedChars,
	wrongLetters,
	hint,
	status = 'playing'
}: PhraseBoardProps) {
	// Agrupamos caracteres por palabra para evitar cortes de línea a mitad de una palabra
	const words: string[][] = [];
	let currentWord: string[] = [];

	for (const char of maskedChars) {
		if (char === ' ') {
			if (currentWord.length > 0) {
				words.push(currentWord);
				currentWord = [];
			}
		} else {
			currentWord.push(char);
		}
	}
	if (currentWord.length > 0) {
		words.push(currentWord);
	}

	const isLost = status === 'lost';
	const remainingLives = Math.max(0, MAX_MISTAKES - wrongLetters.length);

	return (
		<div className="w-full px-3 sm:px-4 flex flex-col items-center gap-3.5 sm:gap-4 select-none">
			{/* Indicador de vidas y pista */}
			<div className="flex flex-wrap items-center justify-center gap-2">
				<div className="inline-flex items-center gap-1.5 bg-[#fffdf9] border border-[#e6d8c3] px-3 py-1 rounded-full shadow-xs">
					<span className="text-xs font-bold text-stone-600">Vidas:</span>
					<div className="flex items-center gap-1">
						{Array.from({ length: MAX_MISTAKES }).map((_, idx) => (
							<span
								key={idx}
								className={`w-2 h-2 rounded-full transition-colors ${
									idx < remainingLives ? 'bg-emerald-500' : 'bg-stone-300'
								}`}
							/>
						))}
					</div>
				</div>

				{hint && (
					<span className="inline-block text-xs font-semibold bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1 rounded-full shadow-xs">
						Pista: {hint}
					</span>
				)}
			</div>

			{/* Tablero de fichas agrupadas por palabra */}
			<div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2.5 max-w-full">
				{words.map((wordChars, wIdx) => (
					<div key={wIdx} className="flex flex-wrap justify-center gap-1">
						{wordChars.map((char, cIdx) => {
							const isHidden = char === '_';
							const isPunctuation = isHidden === false && !/^[A-ZÑ]$/.test(char);

							if (isPunctuation) {
								return (
									<span
										key={cIdx}
										className="w-4 h-8 sm:h-9 flex items-center justify-center font-black text-base text-stone-600"
									>
										{char}
									</span>
								);
							}

							return (
								<div
									key={cIdx}
									className={`w-7 h-8 sm:w-8 sm:h-9 rounded-lg border-2 border-b-4 font-black text-sm sm:text-base flex items-center justify-center shadow-xs transition-colors ${
										isHidden
											? 'bg-[#fffdf9] border-[#e6d8c3] text-transparent'
											: isLost
												? 'bg-rose-500 border-rose-700 text-white'
												: 'bg-emerald-500 border-emerald-700 text-white'
									}`}
								>
									{isHidden ? '' : char}
								</div>
							);
						})}
					</div>
				))}
			</div>

			{/* Letras fallidas */}
			{wrongLetters.length > 0 && (
				<div className="flex flex-wrap items-center justify-center gap-1.5">
					<span className="text-xs font-bold text-stone-500 mr-0.5">Fallos:</span>
					{wrongLetters.map((letter, idx) => (
						<span
							key={idx}
							className="w-6 h-6 rounded-md bg-rose-50 border border-rose-200 text-rose-600 font-black text-xs flex items-center justify-center"
						>
							{letter}
						</span>
					))}
				</div>
			)}
		</div>
	);
}