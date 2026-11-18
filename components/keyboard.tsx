'use client';

import { Delete } from 'lucide-react';
import type { LetterState } from '@/lib/share';

const ROWS = [
	['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
	['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
	['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

interface KeyboardProps {
	mode: 'word' | 'phrase';
	letterStatuses: Record<string, LetterState>;
	disabled?: boolean;
	onKey: (key: string) => void;
}

export function Keyboard({ mode, letterStatuses, disabled, onKey }: KeyboardProps) {
	return (
		<div className="w-full max-w-lg mx-auto select-none space-y-1.5 px-1 pb-2">
			{ROWS.map((row, rIdx) => (
				<div key={rIdx} className="flex justify-center gap-1">
					{row.map((key) => {
						if (mode === 'phrase' && (key === 'ENTER' || key === 'BACK')) {
							return null;
						}

						const isAction = key === 'ENTER' || key === 'BACK';
						const state = letterStatuses[key];

						let bgClass = 'bg-zinc-800 text-zinc-100 active:bg-zinc-700';
						if (state === 'correct') bgClass = 'bg-emerald-600 text-white';
						else if (state === 'present') bgClass = 'bg-amber-500 text-zinc-950';
						else if (state === 'absent') bgClass = 'bg-zinc-900/90 text-zinc-600 opacity-50';

						return (
							<button
								key={key}
								type="button"
								disabled={disabled || (mode === 'phrase' && Boolean(state))}
								onClick={() => onKey(key)}
								className={`h-12 rounded-md font-semibold text-sm transition-transform active:scale-95 flex items-center justify-center ${
									isAction ? 'px-2.5 text-xs flex-1 max-w-[68px]' : 'flex-1 max-w-[38px]'
								} ${bgClass} disabled:pointer-events-none`}
							>
								{key === 'BACK' ? <Delete className="w-4 h-4" /> : key === 'ENTER' ? 'ENVIAR' : key}
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
}