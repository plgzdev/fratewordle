'use client';

import type { LetterState } from '@/lib/share';
import { Delete } from 'lucide-react';

interface KeyboardProps {
	mode: 'word' | 'phrase';
	letterStatuses: Record<string, LetterState>;
	disabled?: boolean;
	onKey: (key: string) => void;
}

const ROWS = [
	['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
	['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
	['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const KEY_STATE_STYLES: Record<LetterState, string> = {
	correct: 'bg-emerald-500 border-emerald-700 text-white shadow-xs',
	present: 'bg-amber-400 border-amber-600 text-amber-950 shadow-xs',
	absent: 'bg-stone-300/80 border-stone-400 text-stone-500'
};

export function Keyboard({ mode, letterStatuses, disabled, onKey }: KeyboardProps) {
	return (
		<div className="w-full max-w-lg mx-auto px-1 sm:px-2 select-none space-y-1 sm:space-y-1.5">
			{ROWS.map((row, rowIdx) => {
				const isLastRow = rowIdx === ROWS.length - 1;

				return (
					<div key={rowIdx} className="flex w-full justify-center gap-0.5 sm:gap-1">
						{isLastRow && mode === 'word' && (
							<button
								type="button"
								disabled={disabled}
								onClick={() => onKey('ENTER')}
								className="px-1.5 sm:px-3.5 h-10 sm:h-12 shrink-0 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 active:translate-y-0.5 border-2 border-b-4 border-emerald-800 text-white font-black text-[10px] sm:text-xs tracking-tight sm:tracking-wide transition-all disabled:opacity-50 cursor-pointer"
							>
								ENVIAR
							</button>
						)}

						{row.map((letter) => {
							const state = letterStatuses[letter];
							const colorClass = state
								? KEY_STATE_STYLES[state]
								: 'bg-[#fffdf9] hover:bg-amber-50 border-stone-300 text-[#292524] shadow-xs';

							return (
								<button
									key={letter}
									type="button"
									disabled={disabled}
									onClick={() => onKey(letter)}
									className={`min-w-0 flex-1 max-w-[38px] h-10 sm:h-12 px-0 rounded-lg sm:rounded-xl border-2 border-b-4 font-extrabold text-xs sm:text-base flex items-center justify-center active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer ${colorClass}`}
								>
									{letter}
								</button>
							);
						})}

						{isLastRow && mode === 'word' && (
							<button
								type="button"
								disabled={disabled}
								onClick={() => onKey('BACK')}
								aria-label="Borrar"
								className="px-2 sm:px-3.5 h-10 sm:h-12 shrink-0 rounded-lg sm:rounded-xl bg-rose-100 hover:bg-rose-200 active:translate-y-0.5 border-2 border-b-4 border-rose-300 text-rose-700 flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
							>
								<Delete className="w-4 h-4 sm:w-5 sm:h-5" />
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}