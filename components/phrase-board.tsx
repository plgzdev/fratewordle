'use client';

import { useEffect, useRef, useState } from 'react';

interface PhraseBoardProps {
	maskedChars: string[];
	wrongLetters: string[];
	hint: string | null;
}

const MAX_LIVES = 6;

export function PhraseBoard({ maskedChars, wrongLetters, hint }: PhraseBoardProps) {
	const [shakeBoard, setShakeBoard] = useState(false);
	const prevWrongCountRef = useRef(wrongLetters.length);

	// Activar sacudida cuando aumenta el contador de fallos
	useEffect(() => {
		if (wrongLetters.length > prevWrongCountRef.current) {
			setShakeBoard(true);
			const timer = setTimeout(() => setShakeBoard(false), 400);
			prevWrongCountRef.current = wrongLetters.length;
			return () => clearTimeout(timer);
		}
		prevWrongCountRef.current = wrongLetters.length;
	}, [wrongLetters.length]);

	// Reconstruir palabras individuales para que nunca se parta una palabra a la mitad
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
	if (currentWord.length > 0) {
		words.push(currentWord);
	}

	const livesLeft = Math.max(0, MAX_LIVES - wrongLetters.length);

	return (
		<div className="w-full flex flex-col items-center gap-3 sm:gap-4 px-2 sm:px-3 select-none">
			{/* Barra de vidas y pista */}
			<div className="flex flex-wrap items-center justify-center gap-2 max-w-full">
				<div className="flex items-center gap-1 bg-[#fffdf9] border border-stone-300 px-3 py-1 rounded-full shadow-xs">
					<span className="text-[11px] font-bold text-stone-500 mr-1">Vidas:</span>
					{Array.from({ length: MAX_LIVES }).map((_, idx) => {
						const active = idx < livesLeft;
						return (
							<span
								key={idx}
								className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
									active
										? 'bg-rose-500 shadow-xs shadow-rose-500/40 scale-100'
										: 'bg-stone-300 scale-75'
								}`}
							/>
						);
					})}
				</div>

				{hint && (
					<span className="text-xs font-semibold bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1 rounded-full shadow-xs text-center">
						Pista: {hint}
					</span>
				)}
			</div>

			{/* Tablero de paneles estilo concurso de TV */}
			<div
				className={`flex flex-wrap justify-center gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-2.5 w-full max-w-md ${
					shakeBoard ? 'animate-board-shake' : ''
				}`}
			>
				{words.map((wordChars, wIdx) => (
					<div key={wIdx} className="flex justify-center gap-0.5 sm:gap-1 max-w-full">
						{wordChars.map((ch, cIdx) => {
							const isHidden = ch === '_';
							const isPunctuation = !isHidden && !/^[A-ZÑ]$/.test(ch);

							if (isPunctuation) {
								return (
									<span
										key={cIdx}
										className="w-3.5 sm:w-5 h-8 sm:h-9 shrink-0 flex items-end justify-center font-black text-base sm:text-lg text-[#292524] pb-1"
									>
										{ch}
									</span>
								);
							}

							return (
								<div
									key={`${cIdx}-${isHidden ? 'hidden' : ch}`}
									style={
										!isHidden ? { animationDelay: `${cIdx * 45}ms` } : undefined
									}
									className={`min-w-0 w-6 h-8 sm:w-8 sm:h-10 rounded-md sm:rounded-lg border-2 border-b-4 font-black text-sm sm:text-lg flex items-center justify-center transition-colors duration-200 ${
										isHidden
											? 'bg-[#fffdf9] border-stone-300 text-transparent shadow-xs'
											: 'bg-emerald-500 border-emerald-700 text-white shadow-sm animate-tile-pop'
									}`}
								>
									{isHidden ? '' : ch}
								</div>
							);
						})}
					</div>
				))}
			</div>

			{/* Letras o intentos fallidos */}
			{wrongLetters.length > 0 && (
				<div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
					<span className="text-[11px] font-bold text-stone-500">Fallos:</span>
					{wrongLetters.map((wl, i) => (
						<span
							key={`${wl}-${i}`}
							className="px-2 py-0.5 text-xs font-extrabold rounded-md bg-rose-100 border border-rose-300 text-rose-700 animate-tile-pop"
						>
							{wl}
						</span>
					))}
				</div>
			)}
		</div>
	);
}