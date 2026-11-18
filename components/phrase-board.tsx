'use client';

interface PhraseBoardProps {
	maskedChars: string[];
	wrongLetters: string[];
	hint: string | null;
}

export function PhraseBoard({ maskedChars, wrongLetters, hint }: PhraseBoardProps) {
	// Agrupamos por palabras usando los espacios para que no se corten en móvil
	const words: string[][] = [];
	let currentWord: string[] = [];

	for (const ch of maskedChars) {
		if (ch === ' ') {
			if (currentWord.length > 0) {
				words.push(currentWord);
				currentWord = [];
			}
		} else {
			currentWord.push(ch);
		}
	}
	if (currentWord.length > 0) words.push(currentWord);

	const livesLeft = Math.max(0, 6 - wrongLetters.length);

	return (
		<div className="w-full max-w-lg mx-auto px-3 flex flex-col items-center gap-5">
			{/* Indicador de vidas y pista */}
			<div className="flex flex-col items-center gap-2 text-center">
				<div className="flex items-center gap-1.5">
					{Array.from({ length: 6 }).map((_, idx) => (
						<span
							key={idx}
							className={`h-2.5 w-7 rounded-full transition-colors ${
								idx < livesLeft ? 'bg-emerald-500' : 'bg-rose-600/80'
							}`}
						/>
					))}
				</div>
				<p className="text-xs text-zinc-400">
					Vidas restantes: <span className="font-semibold text-zinc-200">{livesLeft}/6</span>
				</p>
				{hint && (
					<span className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full">
						Pista: {hint}
					</span>
				)}
			</div>

			{/* Casillas de la frase agrupadas por palabra */}
			<div className="flex flex-wrap justify-center gap-x-5 gap-y-3 py-2">
				{words.map((wordChars, wIdx) => (
					<div key={wIdx} className="flex gap-1">
						{wordChars.map((ch, cIdx) => {
							const isHidden = ch === '_';
							const isSymbol = !/^[A-ZÑ_]$/.test(ch);

							if (isSymbol) {
								return (
									<span
										key={cIdx}
										className="h-10 w-5 flex items-end justify-center text-xl font-bold text-zinc-400 pb-1"
									>
										{ch}
									</span>
								);
							}

							return (
								<div
									key={cIdx}
									className={`h-10 w-8 sm:h-11 sm:w-9 rounded-md border-b-2 flex items-center justify-center text-lg font-bold transition-all ${
										isHidden
											? 'bg-zinc-900/90 border-zinc-700 text-transparent'
											: 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
									}`}
								>
									{isHidden ? '' : ch}
								</div>
							);
						})}
					</div>
				))}
			</div>

			{/* Letras fallidas */}
			{wrongLetters.length > 0 && (
				<div className="flex items-center gap-1.5 flex-wrap justify-center">
					<span className="text-xs text-zinc-500">Fallos:</span>
					{wrongLetters.map((l) => (
						<span
							key={l}
							className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800/60 text-rose-300"
						>
							{l}
						</span>
					))}
				</div>
			)}
		</div>
	);
}