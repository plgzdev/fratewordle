'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	getInitialGameData,
	solvePhraseGuess,
	submitPhraseLetter,
	submitWordGuess,
	updateDisplayName
} from '@/app/actions/game';
import { authClient } from '@/lib/auth-client';
import { buildPhraseShareText, buildWordShareText, type LetterState } from '@/lib/share';
import { WordBoard } from './word-board';
import { PhraseBoard } from './phrase-board';
import { Keyboard } from './keyboard';
import { AuthScreen } from './auth-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '@/components/ui/dialog';
import { Flame, LogIn, LogOut, Share2, Sparkles, Trophy, UserPen } from 'lucide-react';

type InitialData = Awaited<ReturnType<typeof getInitialGameData>>;
type GameStatus = 'playing' | 'won' | 'lost';

export function GameShell({ initialData }: { initialData: InitialData }) {
	const [data, setData] = useState<InitialData>(initialData);
	const [activeTab, setActiveTab] = useState<'word' | 'phrase' | 'ranking'>('word');
	const [rankingPeriod, setRankingPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
	const [currentGuess, setCurrentGuess] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [toastMsg, setToastMsg] = useState<string | null>(null);
	const [shake, setShake] = useState(false);
	const [copied, setCopied] = useState(false);
	const [logoutOpen, setLogoutOpen] = useState(false);

	// Modal de login opcional, edición de apodo y resolver frase completa
	const [authOpen, setAuthOpen] = useState(false);
	const [nameOpen, setNameOpen] = useState(false);
	const [nameInput, setNameInput] = useState(initialData.user?.name ?? '');
	const [solveOpen, setSolveOpen] = useState(false);
	const [solveInput, setSolveInput] = useState('');

	const showToast = useCallback((msg: string) => {
		setToastMsg(msg);
		setTimeout(() => setToastMsg(null), 2200);
	}, []);

	const refreshData = useCallback(async () => {
		const fresh = await getInitialGameData();
		setData(fresh);
		if (fresh.user) {
			setNameInput(fresh.user.name);
		}
	}, []);

	// Si juega como invitado, restaurar progreso diario desde localStorage
	useEffect(() => {
		if (data.user) return;

		if (data.wordState) {
			const savedWord = localStorage.getItem(`fws_word_${data.wordState.dateStr}`);
			if (savedWord) {
				try {
					const parsed = JSON.parse(savedWord);
					setData((prev) =>
						prev.wordState ? { ...prev, wordState: { ...prev.wordState, ...parsed } } : prev
					);
				} catch {
					// Ignorar storage corrupto
				}
			}
		}

		if (data.phraseState) {
			const savedPhrase = localStorage.getItem(`fws_phrase_${data.phraseState.dateStr}`);
			if (savedPhrase) {
				try {
					const parsed = JSON.parse(savedPhrase);
					setData((prev) =>
						prev.phraseState
							? { ...prev, phraseState: { ...prev.phraseState, ...parsed } }
							: prev
					);
				} catch {
					// Ignorar storage corrupto
				}
			}
		}
	}, [data.user, data.wordState?.dateStr, data.phraseState?.dateStr]);

	// Estados de letras en el teclado para Modo Palabra
	const wordLetterStatuses = useMemo(() => {
		const map: Record<string, LetterState> = {};
		if (!data.wordState) return map;

		data.wordState.guesses.forEach((guess, gIdx) => {
			const evalRow = data.wordState!.evaluations[gIdx];
			if (!evalRow) return;
			guess.split('').forEach((char, cIdx) => {
				const st = evalRow[cIdx];
				const prev = map[char];
				if (st === 'correct') map[char] = 'correct';
				else if (st === 'present' && prev !== 'correct') map[char] = 'present';
				else if (st === 'absent' && !prev) map[char] = 'absent';
			});
		});
		return map;
	}, [data.wordState]);

	// Estados de letras en el teclado para Modo Frase
	const phraseLetterStatuses = useMemo(() => {
		const map: Record<string, LetterState> = {};
		if (!data.phraseState) return map;

		const wrongSet = new Set(data.phraseState.wrongLetters);
		for (const letter of data.phraseState.guessedLetters) {
			map[letter] = wrongSet.has(letter) ? 'absent' : 'correct';
		}
		return map;
	}, [data.phraseState]);

	const handleWordKey = useCallback(
		async (key: string) => {
			const ws = data.wordState;
			if (!ws || ws.status !== 'playing' || submitting) return;

			if (key === 'BACK') {
				setCurrentGuess((prev) => prev.slice(0, -1));
				return;
			}

			if (key === 'ENTER') {
				if (currentGuess.length !== ws.length) {
					setShake(true);
					setTimeout(() => setShake(false), 400);
					showToast(`Faltan letras (${ws.length})`);
					return;
				}

				setSubmitting(true);
				const res = await submitWordGuess(currentGuess, ws.guesses);
				setSubmitting(false);

				if ('error' in res) {
					setShake(true);
					setTimeout(() => setShake(false), 400);
					if (res.error === 'NOT_IN_DICTIONARY') showToast('Palabra no válida');
					else showToast('No se pudo enviar');
					return;
				}

				const updatedState = {
					guesses: [...ws.guesses, res.guess],
					evaluations: [...ws.evaluations, res.evaluation],
					status: res.status as GameStatus,
					score: res.score,
					solution: res.solution
				};

				setCurrentGuess('');
				setData((prev) =>
					prev.wordState ? { ...prev, wordState: { ...prev.wordState, ...updatedState } } : prev
				);

				if (data.user) {
					await refreshData();
				} else {
					localStorage.setItem(`fws_word_${ws.dateStr}`, JSON.stringify(updatedState));
				}

				if (res.status === 'won') showToast(`¡Brutal! +${res.score} pts`);
				else if (res.status === 'lost') showToast(`Era: ${res.solution}`);
				return;
			}

			if (/^[A-ZÑ]$/.test(key) && currentGuess.length < ws.length) {
				setCurrentGuess((prev) => prev + key);
			}
		},
		[currentGuess, data.user, data.wordState, refreshData, showToast, submitting]
	);

	const handlePhraseKey = useCallback(
		async (key: string) => {
			const ps = data.phraseState;
			if (!ps || ps.status !== 'playing' || submitting) return;
			if (!/^[A-ZÑ]$/.test(key)) return;
			if (ps.guessedLetters.includes(key)) return;

			setSubmitting(true);
			const res = await submitPhraseLetter(key, ps.guessedLetters);
			setSubmitting(false);

			if ('ok' in res && res.ok) {
				const previousWrongResolutions = ps.wrongLetters.filter((l) => l === '✕').length;
				const combinedWrongLetters = [
					...res.wrongLetters,
					...Array(previousWrongResolutions).fill('✕')
				];
				const lostByResolutions = res.status === 'playing' && combinedWrongLetters.length >= 6;
				const finalStatus: GameStatus = lostByResolutions
					? 'lost'
					: (res.status as GameStatus);

				const updatedState = {
					maskedChars: res.maskedChars,
					guessedLetters: res.guessedLetters,
					wrongLetters: combinedWrongLetters,
					status: finalStatus,
					score: finalStatus === 'lost' ? 0 : res.score,
					solution: res.solution
				};

				setData((prev) =>
					prev.phraseState
						? { ...prev, phraseState: { ...prev.phraseState, ...updatedState } }
						: prev
				);

				if (data.user) {
					refreshData();
				} else {
					localStorage.setItem(`fws_phrase_${ps.dateStr}`, JSON.stringify(updatedState));
				}

				if (finalStatus === 'won') showToast(`¡Frase resuelta! +${res.score} pts`);
				else if (finalStatus === 'lost') showToast('Sin vidas hoy');
			}
		},
		[data.phraseState, data.user, refreshData, showToast, submitting]
	);

	async function handleSolvePhraseSubmit(e: React.FormEvent) {
		e.preventDefault();
		const ps = data.phraseState;
		if (!ps || ps.status !== 'playing' || submitting || !solveInput.trim()) return;

		setSubmitting(true);
		const guestWrongResolutions = ps.wrongLetters.filter((l) => l === '✕').length;
		const res = await solvePhraseGuess(solveInput, ps.guessedLetters, guestWrongResolutions);
		setSubmitting(false);

		if ('ok' in res && res.ok) {
			setSolveInput('');
			setSolveOpen(false);

			if (data.user) {
				await refreshData();
			} else {
				const updatedState = {
					maskedChars: res.maskedChars,
					guessedLetters: res.guessedLetters,
					wrongLetters: res.wrongLetters,
					status: res.status as GameStatus,
					score: res.score,
					solution: res.solution
				};
				localStorage.setItem(`fws_phrase_${ps.dateStr}`, JSON.stringify(updatedState));
				setData((prev) =>
					prev.phraseState
						? { ...prev, phraseState: { ...prev.phraseState, ...updatedState } }
						: prev
				);
			}

			if (res.isCorrect) {
				showToast(`¡Frase resuelta! +${res.score} pts`);
			} else if (res.status === 'lost') {
				showToast('Frase incorrecta · Sin vidas hoy');
			} else {
				showToast('Frase incorrecta (-1 vida)');
			}
		}
	}

	// Soporte para teclado físico en PC
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (nameOpen || authOpen || solveOpen || logoutOpen || activeTab === 'ranking') return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;

			const k = e.key.toUpperCase();
			if (k === 'BACKSPACE') {
				if (activeTab === 'word') handleWordKey('BACK');
			} else if (k === 'ENTER') {
				if (activeTab === 'word') handleWordKey('ENTER');
			} else if (/^[A-ZÑ]$/.test(k)) {
				if (activeTab === 'word') handleWordKey(k);
				else if (activeTab === 'phrase') handlePhraseKey(k);
			}
		}

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [activeTab, authOpen, handlePhraseKey, handleWordKey, nameOpen, solveOpen]);

	async function handleShare(mode: 'word' | 'phrase') {
		const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
		let text = '';

		if (mode === 'word' && data.wordState) {
			text = buildWordShareText({
				dayNumber: data.wordState.id,
				evaluations: data.wordState.evaluations,
				won: data.wordState.status === 'won',
				score: data.wordState.score,
				appUrl
			});
		} else if (mode === 'phrase' && data.phraseState) {
			text = buildPhraseShareText({
				dayNumber: data.phraseState.id,
				wrongCount: data.phraseState.wrongLetters.length,
				won: data.phraseState.status === 'won',
				score: data.phraseState.score,
				appUrl
			});
		}

		if (!text) return;

		if (navigator.share) {
			try {
				await navigator.share({ text });
				return;
			} catch {
				// Fallback a portapapeles
			}
		}

		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	async function handleSaveName(e: React.FormEvent) {
		e.preventDefault();
		const res = await updateDisplayName(nameInput);
		if ('ok' in res) {
			setNameOpen(false);
			await refreshData();
			showToast('Apodo actualizado');
		}
	}

	const currentUserStreak = data.user
		? (data.leaderboards.daily.find((p) => p.id === data.user?.id)?.currentStreak ?? 0)
		: 0;
	return (
		<div className="min-h-dvh w-full overflow-x-hidden bg-retro-board text-[#292524] flex flex-col justify-between">
			{/* Header cálido estilo tablero clásico */}
			<header className="border-b-2 border-[#e6d8c3] bg-[#fffdf9]/90 backdrop-blur-md px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 max-w-lg w-full mx-auto shadow-xs">
				<div className="flex items-center gap-2 shrink-0 min-w-0">
					<div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-emerald-500 border-2 border-b-4 border-emerald-700 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-xs">
						F
					</div>
					<div className="min-w-0">
						<h1 className="font-black text-sm sm:text-base tracking-tight text-[#292524] truncate">
							Frate<span className="text-emerald-600">Wordle</span>Squad
						</h1>
						{data.user ? (
							<div className="flex items-center gap-2 shrink-0 text-xs text-stone-600 font-medium">
								<span>{data.user.name}</span>
								<span className="inline-flex items-center gap-0.5 text-orange-600 font-extrabold bg-orange-100 px-1.5 py-0.2 rounded-full">
									<Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-600" />
									{currentUserStreak}
								</span>
							</div>
						) : (
							<p className="text-[11px] text-stone-500 font-medium">Modo invitado</p>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					{data.user ? (
						<>
							<Dialog open={nameOpen} onOpenChange={setNameOpen}>
								<DialogTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#f7eedb] border border-stone-300 text-stone-700 hover:bg-amber-100 transition-colors cursor-pointer">
									<UserPen className="w-4 h-4" />
								</DialogTrigger>
								<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] max-w-xs">
									<DialogHeader>
										<DialogTitle>Tu apodo en el Squad</DialogTitle>
									</DialogHeader>
									<form onSubmit={handleSaveName} className="space-y-3 pt-2">
										<Input
											value={nameInput}
											onChange={(e) => setNameInput(e.target.value)}
											maxLength={24}
											placeholder="Tu apodo"
											className="bg-[#fdf8ee] border-stone-300 text-[#292524]"
										/>
										<Button
											type="submit"
											className="w-full bg-emerald-600 hover:bg-emerald-500 border-b-4 border-emerald-800 text-white font-bold"
										>
											Guardar
										</Button>
									</form>
								</DialogContent>
							</Dialog>

							<Button
								variant="ghost"
								size="icon"
								onClick={() => setLogoutOpen(true)}
								className="rounded-xl text-stone-500 hover:text-rose-600 hover:bg-rose-50"
							>
								<LogOut className="w-4 h-4" />
							</Button>
						</>
					) : (
						<button
							type="button"
							onClick={() => setAuthOpen(true)}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#fffdf9] hover:bg-amber-50 border-2 border-b-4 border-stone-300 text-[#292524] text-xs font-extrabold active:translate-y-0.5 transition-all cursor-pointer"
						>
							<LogIn className="w-3.5 h-3.5 text-emerald-600" />
							Entrar
						</button>
					)}
				</div>
			</header>

			{/* Modal de Login Opcional */}
			<Dialog open={authOpen} onOpenChange={setAuthOpen}>
				<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] max-w-sm p-0 overflow-hidden">
					<DialogHeader className="sr-only">
						<DialogTitle>Iniciar sesión en FrateWordleSquad</DialogTitle>
					</DialogHeader>
					<AuthScreen
						onSuccess={async () => {
							setAuthOpen(false);
							await refreshData();
							showToast('¡Sesión iniciada!');
						}}
					/>
				</DialogContent>
			</Dialog>

			{/* Modal para Resolver Frase Completa */}
			<Dialog open={solveOpen} onOpenChange={setSolveOpen}>
				<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] max-w-sm">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-amber-800 font-black">
							<Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
							Resolver la frase completa
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSolvePhraseSubmit} className="space-y-3 pt-1">
						<p className="text-xs text-stone-600 leading-relaxed">
							Si aciertas ahora ganas <span className="text-emerald-700 font-bold">puntos extra</span> por las letras sin revelar. Si fallas pierdes 1 vida.
						</p>
						<Input
							value={solveInput}
							onChange={(e) => setSolveInput(e.target.value)}
							placeholder="Escribe la frase completa..."
							autoFocus
							className="bg-[#fdf8ee] border-2 border-stone-300 focus-visible:ring-amber-400 uppercase font-bold text-[#292524]"
						/>
						<button
							type="submit"
							disabled={submitting}
							className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 border-2 border-b-4 border-amber-600 text-amber-950 font-black text-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer"
						>
							{submitting ? 'Comprobando...' : 'Comprobar frase'}
						</button>
					</form>
				</DialogContent>
			</Dialog>

			{/* Modal de confirmación para Cerrar Sesión */}
			<Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
				<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] max-w-xs">
					<DialogHeader>
						<DialogTitle className="font-black text-base">¿Cerrar sesión?</DialogTitle>
					</DialogHeader>
					<p className="text-xs text-stone-600 leading-relaxed">
						Tu progreso y tu racha quedan guardados en tu cuenta. Podrás volver a entrar cuando quieras con tu correo y contraseña.
					</p>
					<div className="flex gap-2 pt-2">
						<button
							type="button"
							onClick={() => setLogoutOpen(false)}
							className="flex-1 py-2 rounded-xl bg-[#f7eedb] hover:bg-stone-200 border-2 border-b-4 border-stone-300 text-stone-700 font-bold text-xs transition-all cursor-pointer"
						>
							Cancelar
						</button>
						<button
							type="button"
							onClick={async () => {
								await authClient.signOut();
								window.location.reload();
							}}
							className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 active:translate-y-0.5 border-2 border-b-4 border-rose-700 text-white font-black text-xs transition-all cursor-pointer"
						>
							Sí, salir
						</button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Toast flotante */}
			{toastMsg && (
				<div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#292524] text-[#fdf8ee] text-xs font-extrabold px-4 py-2 rounded-full shadow-lg">
					{toastMsg}
				</div>
			)}

			{/* Contenido principal con pestañas */}
			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as 'word' | 'phrase' | 'ranking')}
				className="flex-1 flex flex-col justify-between max-w-lg w-full mx-auto"
			>
				<div className="px-3 sm:px-4 pt-2.5 w-full">
					<TabsList className="grid grid-cols-3 w-full bg-[#f7eedb] border-2 border-[#e6d8c3] p-1 rounded-2xl h-10 sm:h-11">
						<TabsTrigger
							value="word"
							className="rounded-xl text-xs sm:text-sm font-bold text-stone-600 px-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-xs"
						>
							Palabra
						</TabsTrigger>
						<TabsTrigger
							value="phrase"
							className="rounded-xl text-xs sm:text-sm font-bold text-stone-600 px-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-xs"
						>
							Frase
						</TabsTrigger>
						<TabsTrigger
							value="ranking"
							className="gap-1 rounded-xl text-xs sm:text-sm font-bold text-stone-600 px-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-xs"
						>
							<Trophy className="w-3.5 h-3.5 shrink-0" />
							<span>Ranking</span>
						</TabsTrigger>
					</TabsList>
				</div>
				{/* TAB 1: PALABRA DE LONGITUD VARIABLE */}
				<TabsContent value="word" className="flex-1 flex flex-col justify-center pt-3 pb-6 gap-5">
					{!data.wordState ? (
						<p className="text-center text-sm text-stone-500 my-auto">
							No hay palabra programada para hoy.
						</p>
					) : (
						<>
							<div className="text-center space-y-1.5 px-4">
								<p className="text-xs text-stone-600 font-medium">
									Palabra de <span className="font-black text-[#292524]">{data.wordState.length} letras</span>
								</p>
								{data.wordState.hint && (
									<span className="inline-block text-xs font-semibold bg-amber-100 border border-amber-300 text-amber-900 px-3 py-0.5 rounded-full shadow-xs">
										Pista: {data.wordState.hint}
									</span>
								)}
							</div>

							<WordBoard
								length={data.wordState.length}
								guesses={data.wordState.guesses}
								evaluations={data.wordState.evaluations}
								currentGuess={currentGuess}
								isPlaying={data.wordState.status === 'playing'}
								shake={shake}
							/>

							{data.wordState.status !== 'playing' ? (
								<div className="px-4 py-3 text-center space-y-3">
									<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-4 space-y-1 shadow-sm">
										<p className="text-xs font-bold text-stone-500">
											{data.wordState.status === 'won' ? '¡Adivinada!' : 'La palabra era:'}
										</p>
										<p className="text-2xl font-black tracking-widest text-emerald-600">
											{data.wordState.solution}
										</p>
										<p className="text-xs font-semibold text-stone-500">Puntos hoy: {data.wordState.score}</p>
									</div>
									{!data.user && (
										<button
											type="button"
											onClick={() => setAuthOpen(true)}
											className="w-full py-2.5 rounded-xl bg-[#fffdf9] hover:bg-emerald-50 border-2 border-b-4 border-emerald-500 text-emerald-700 font-extrabold text-xs active:translate-y-0.5 transition-all cursor-pointer"
										>
											Inicia sesión para entrar al Ranking
										</button>
									)}
									<button
										type="button"
										onClick={() => handleShare('word')}
										className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
									>
										<Share2 className="w-4 h-4" />
										{copied ? '¡Copiado para WhatsApp!' : 'Compartir resultado'}
									</button>
								</div>
							) : (
								<Keyboard
									mode="word"
									letterStatuses={wordLetterStatuses}
									disabled={submitting}
									onKey={handleWordKey}
								/>
							)}
						</>
					)}
				</TabsContent>

				{/* TAB 2: FRASE ESTILO RULETA DE LA FORTUNA */}
				<TabsContent value="phrase" className="flex-1 flex flex-col justify-center pt-4 pb-6 gap-6">
					{!data.phraseState ? (
						<p className="text-center text-sm text-stone-500 my-auto">
							No hay frase programada para hoy.
						</p>
					) : (
						<>
							<div className="space-y-5">
								<PhraseBoard
									maskedChars={data.phraseState.maskedChars}
									wrongLetters={data.phraseState.wrongLetters}
									hint={data.phraseState.hint}
								/>

								{data.phraseState.status === 'playing' && (
									<div className="flex justify-center px-4">
										<button
											type="button"
											onClick={() => setSolveOpen(true)}
											className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-amber-950 font-black text-xs uppercase tracking-wider shadow-md border-2 border-b-4 border-amber-600 transition-all cursor-pointer"
										>
											<Sparkles className="w-4 h-4 stroke-[2.5] text-amber-900" />
											Resolver frase completa
										</button>
									</div>
								)}
							</div>

							{data.phraseState.status !== 'playing' ? (
								<div className="px-4 py-3 text-center space-y-3">
									<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-4 space-y-1 shadow-sm">
										<p className="text-xs font-bold text-stone-500">
											{data.phraseState.status === 'won' ? '¡Frase completada!' : 'La frase era:'}
										</p>
										<p className="text-base font-black tracking-wide text-emerald-600">
											{data.phraseState.solution}
										</p>
										<p className="text-xs font-semibold text-stone-500">Puntos hoy: {data.phraseState.score}</p>
									</div>
									{!data.user && (
										<button
											type="button"
											onClick={() => setAuthOpen(true)}
											className="w-full py-2.5 rounded-xl bg-[#fffdf9] hover:bg-emerald-50 border-2 border-b-4 border-emerald-500 text-emerald-700 font-extrabold text-xs active:translate-y-0.5 transition-all cursor-pointer"
										>
											Inicia sesión para entrar al Ranking
										</button>
									)}
									<button
										type="button"
										onClick={() => handleShare('phrase')}
										className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
									>
										<Share2 className="w-4 h-4" />
										{copied ? '¡Copiado para WhatsApp!' : 'Compartir resultado'}
									</button>
								</div>
							) : (
								<Keyboard
									mode="phrase"
									letterStatuses={phraseLetterStatuses}
									disabled={submitting}
									onKey={handlePhraseKey}
								/>
							)}
						</>
					)}
				</TabsContent>

				{/* TAB 3: RANKING DEL SQUAD */}
				{/* TAB 3: RANKING DEL SQUAD (DIARIO / SEMANAL / MENSUAL) */}
				<TabsContent value="ranking" className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
					{!data.user && (
						<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-4 text-center space-y-2.5 shadow-xs">
							<p className="text-sm font-black text-[#292524]">
								¿Quieres aparecer en la tabla del Squad?
							</p>
							<p className="text-xs text-stone-600">
								Inicia sesión con tu correo y elige tu apodo. Nunca mostraremos tu correo en la tabla.
							</p>
							<button
								type="button"
								onClick={() => setAuthOpen(true)}
								className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-xs transition-all cursor-pointer"
							>
								Iniciar sesión / Registrarme
							</button>
						</div>
					)}

					{/* Selector Hoy / Semana / Mes */}
					<div className="grid grid-cols-3 bg-[#f7eedb] border-2 border-[#e6d8c3] p-1 rounded-xl text-xs font-extrabold">
						{(
							[
								{ id: 'daily', label: 'Hoy' },
								{ id: 'weekly', label: 'Esta Semana' },
								{ id: 'monthly', label: 'Este Mes' }
							] as const
						).map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setRankingPeriod(tab.id)}
								className={`py-1.5 rounded-lg transition-all cursor-pointer ${
									rankingPeriod === tab.id
										? 'bg-amber-400 text-amber-950 shadow-xs'
										: 'text-stone-600 hover:text-stone-900'
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>

					{(() => {
						const activeBoard = data.leaderboards[rankingPeriod];
						if (activeBoard.length === 0) {
							return (
								<p className="text-center text-xs text-stone-500 py-8">
									Aún no hay jugadores registrados en el ranking.
								</p>
							);
						}

						return activeBoard.map((player, index) => {
							const isMe = data.user?.id === player.id;
							return (
								<div
									key={player.id}
									className={`flex items-center justify-between p-3.5 rounded-2xl border-2 border-b-4 transition-colors ${
										isMe
											? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
											: 'bg-[#fffdf9] border-[#e6d8c3]'
									}`}
								>
									<div className="flex items-center gap-3 shrink-0">
										<span
											className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center border ${
												index === 0
													? 'bg-amber-400 border-amber-600 text-amber-950'
													: index === 1
														? 'bg-stone-200 border-stone-400 text-stone-800'
														: index === 2
															? 'bg-orange-300 border-orange-500 text-orange-950'
															: 'bg-[#f7eedb] border-[#e6d8c3] text-stone-600'
											}`}
										>
											{index + 1}
										</span>
										<div>
											<p className="text-sm font-extrabold text-[#292524]">
												{player.name}{' '}
												{isMe && <span className="text-xs text-emerald-600">(Tú)</span>}
											</p>
											<p className="text-xs text-stone-500 font-medium">
												{player.gamesWon}{' '}
												{player.gamesWon === 1 ? 'ganada' : 'ganadas'} · Racha:{' '}
												{player.currentStreak}
											</p>
										</div>
									</div>
									<div className="text-right">
										<p className="text-sm font-black text-emerald-600">{player.totalPoints} pts</p>
									</div>
								</div>
							);
						});
					})()}
				</TabsContent>
			</Tabs>
		</div>
	);
}