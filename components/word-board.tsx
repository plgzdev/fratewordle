'use client';

import type { LetterState } from '@/lib/share';

interface WordBoardProps {
	length: number;
	guesses: string[];
	evaluations: LetterState[][];
	currentGuess: string;
	isPlaying: boolean;
	shake: boolean;
}

export function WordBoard({
	length,
	guesses,
	evaluations,
	currentGuess,
	isPlaying,
	shake
}: WordBoardProps) {
	const rows = Array.from({ length: 6 }, (_, rowIdx) => {
		if (rowIdx < guesses.length) {
			return {
				chars: guesses[rowIdx].split(''),
				evals: evaluations[rowIdx],
				isCurrent: false
			};
		}
		if (rowIdx === guesses.length && isPlaying) {
			const chars = currentGuess.padEnd(length, ' ').split('');
			return { chars, evals: null, isCurrent: true };
		}
		return {
			chars: Array(length).fill(' '),
			evals: null,
			isCurrent: false
		};
	});

	const tileSize =
		length <= 5
			? 'h-13 text-2xl'
			: length <= 7
				? 'h-11 text-xl'
				: 'h-9 text-base';

	return (
		<div className="w-full max-w-md mx-auto px-2 flex flex-col gap-1.5">
			{rows.map((row, rIdx) => (
				<div
					key={rIdx}
					style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
					className={`grid gap-1.5 ${row.isCurrent && shake ? 'animate-bounce' : ''}`}
				>
					{row.chars.map((char, cIdx) => {
						const state = row.evals?.[cIdx];
						const filled = char !== ' ';

						let style = 'border-zinc-800 bg-zinc-950/60 text-zinc-100';
						if (state === 'correct') style = 'border-emerald-500 bg-emerald-600 text-white';
						else if (state === 'present') style = 'border-amber-500 bg-amber-500 text-zinc-950';
						else if (state === 'absent') style = 'border-zinc-800 bg-zinc-800 text-zinc-400';
						else if (filled) style = 'border-zinc-500 bg-zinc-900 text-white scale-[1.03]';

						return (
							<div
								key={cIdx}
								className={`${tileSize} border-2 rounded-md font-bold flex items-center justify-center uppercase transition-all ${style}`}
							>
								{filled ? char : ''}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}