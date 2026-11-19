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

const MAX_ROWS = 6;

const STATE_STYLES: Record<LetterState, string> = {
	correct: 'bg-emerald-500 border-emerald-700 text-white shadow-sm',
	present: 'bg-amber-400 border-amber-600 text-amber-950 shadow-sm',
	absent: 'bg-stone-300 border-stone-400 text-stone-600'
};

export function WordBoard({
	length,
	guesses,
	evaluations,
	currentGuess,
	isPlaying,
	shake
}: WordBoardProps) {
	const maxWidthClass =
		length >= 9
			? 'max-w-[440px]'
			: length >= 7
				? 'max-w-[420px]'
				: 'max-w-[350px]';

	const textSizeClass =
		length >= 9
			? 'text-sm sm:text-base'
			: length >= 7
				? 'text-base sm:text-lg'
				: 'text-lg sm:text-xl';

	return (
		<div className="w-full flex flex-col items-center gap-1 sm:gap-1.5 px-3 select-none">
			{Array.from({ length: MAX_ROWS }).map((_, rowIndex) => {
				const isSubmitted = rowIndex < guesses.length;
				const isLatestSubmitted = rowIndex === guesses.length - 1;
				const isCurrentRow = isPlaying && rowIndex === guesses.length;
				const rowWord = isSubmitted
					? guesses[rowIndex]
					: isCurrentRow
						? currentGuess.padEnd(length, ' ')
						: ' '.repeat(length);

				return (
					<div
						key={rowIndex}
						style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
						className={`grid w-full ${maxWidthClass} gap-1 sm:gap-1.5 ${
							isCurrentRow && shake ? 'animate-board-shake' : ''
						}`}
					>
						{Array.from({ length }).map((__, colIndex) => {
							const char = rowWord[colIndex]?.trim() ?? '';
							const state = isSubmitted ? evaluations[rowIndex]?.[colIndex] : undefined;

							let cellStyle =
								'bg-[#f7eedb]/80 border-2 border-b-4 border-stone-300/80 text-transparent';
							if (state) {
								cellStyle = `border-2 border-b-4 ${STATE_STYLES[state]}`;
							} else if (char) {
								cellStyle =
									'bg-[#fffdf9] border-2 border-b-4 border-amber-500/80 text-[#292524] scale-[1.03] shadow-sm';
							}

							return (
								<div
									key={colIndex}
									style={
										isLatestSubmitted
											? { animationDelay: `${colIndex * 110}ms` }
											: undefined
									}
									className={`aspect-square w-full ${textSizeClass} rounded-lg sm:rounded-xl font-black uppercase flex items-center justify-center ${cellStyle} ${
										isLatestSubmitted
											? 'animate-tile-flip will-change-transform'
											: 'transition-transform duration-100'
									}`}
								>
									{char}
								</div>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}