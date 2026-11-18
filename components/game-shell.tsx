'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	getInitialGameData,
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
import { Flame, LogIn, LogOut, Share2, Trophy, UserPen } from 'lucide-react';

type InitialData = Awaited<ReturnType<typeof getInitialGameData>>;
type GameStatus = 'playing' | 'won' | 'lost';

export function GameShell({ initialData }: { initialData: InitialData }) {
	const [data, setData] = useState<InitialData>(initialData);
	const [activeTab, setActiveTab] = useState<'word' | 'phrase' | 'ranking'>('word');
	const [currentGuess, setCurrentGuess] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [toastMsg, setToastMsg] = useState<string | null>(null);
	const [shake, setShake] = useState(false);
	const [copied, setCopied] = useState(false);

	// Modal de login opcional y edición de apodo
	const [authOpen, setAuthOpen] = useState(false);
	const [nameOpen, setNameOpen] = useState(false);
	const [nameInput, setNameInput] = useState(initialData.user?.name ?? '');

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

				setCurrentGuess('');

				if (data.user) {
					await refreshData();
				} else {
					const updatedState = {
						guesses: [...ws.guesses, res.guess],
						evaluations: [...ws.evaluations, res.evaluation],
						status: res.status as GameStatus,
						score: res.score,
						solution: res.solution
					};
					localStorage.setItem(`fws_word_${ws.dateStr}`, JSON.stringify(updatedState));
					setData((prev) =>
						prev.wordState ? { ...prev, wordState: { ...prev.wordState, ...updatedState } } : prev
					);
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

				if (res.status === 'won') showToast(`¡Frase resuelta! +${res.score} pts`);
				else if (res.status === 'lost') showToast('Sin vidas hoy');
			}
		},
		[data.phraseState, data.user, refreshData, showToast, submitting]
	);

	// Soporte para teclado físico en PC
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (nameOpen || authOpen || activeTab === 'ranking') return;
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
	}, [activeTab, authOpen, handlePhraseKey, handleWordKey, nameOpen]);

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
		? (data.leaderboard.find((p) => p.id === data.user?.id)?.currentStreak ?? 0)
		: 0;

	return (
		<div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col justify-between">
			{/* Header compacto */}
			<header className="border-b border-zinc-900 px-4 py-3 flex items-center justify-between max-w-lg w-full mx-auto">
				<div>
					<h1 className="font-extrabold text-base tracking-tight">FrateWordSquad</h1>
					{data.user ? (
						<div className="flex items-center gap-2 text-xs text-zinc-400">
							<span>{data.user.name}</span>
							<span className="inline-flex items-center gap-0.5 text-amber-400 font-semibold">
								<Flame className="w-3.5 h-3.5 fill-amber-400" />
								{currentUserStreak}
							</span>
						</div>
					) : (
						<p className="text-xs text-zinc-500">Modo invitado</p>
					)}
				</div>

				<div className="flex items-center gap-1">
					{data.user ? (
						<>
							<Dialog open={nameOpen} onOpenChange={setNameOpen}>
								<DialogTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900">
									<UserPen className="w-4 h-4" />
								</DialogTrigger>
								<DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-xs">
									<DialogHeader>
										<DialogTitle>Tu apodo en el Squad</DialogTitle>
									</DialogHeader>
									<form onSubmit={handleSaveName} className="space-y-3 pt-2">
										<Input
											value={nameInput}
											onChange={(e) => setNameInput(e.target.value)}
											maxLength={24}
											placeholder="Tu apodo"
											className="bg-zinc-950 border-zinc-800"
										/>
										<Button type="submit" className="w-full">
											Guardar
										</Button>
									</form>
								</DialogContent>
							</Dialog>

							<Button
								variant="ghost"
								size="icon"
								onClick={async () => {
									await authClient.signOut();
									window.location.reload();
								}}
								className="text-zinc-400 hover:text-rose-400"
							>
								<LogOut className="w-4 h-4" />
							</Button>
						</>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setAuthOpen(true)}
							className="gap-1.5 border-zinc-800 bg-zinc-900 text-xs"
						>
							<LogIn className="w-3.5 h-3.5" />
							Entrar
						</Button>
					)}
				</div>
			</header>

			{/* Modal de Login Opcional */}
			<Dialog open={authOpen} onOpenChange={setAuthOpen}>
				<DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-sm p-0 overflow-hidden">
					<DialogHeader className="sr-only">
						<DialogTitle>Iniciar sesión en FrateWordSquad</DialogTitle>
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

			{/* Toast flotante */}
			{toastMsg && (
				<div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-zinc-100 text-zinc-950 text-xs font-bold px-4 py-2 rounded-full shadow-lg">
					{toastMsg}
				</div>
			)}

			{/* Contenido principal con pestañas */}
			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as 'word' | 'phrase' | 'ranking')}
				className="flex-1 flex flex-col justify-between max-w-lg w-full mx-auto"
			>
				<div className="px-4 pt-3">
					<TabsList className="grid grid-cols-3 w-full bg-zinc-900 border border-zinc-800">
						<TabsTrigger value="word">Palabra</TabsTrigger>
						<TabsTrigger value="phrase">Frase</TabsTrigger>
						<TabsTrigger value="ranking" className="gap-1">
							<Trophy className="w-3.5 h-3.5" />
							Ranking
						</TabsTrigger>
					</TabsList>
				</div>

				{/* TAB 1: PALABRA DE LONGITUD VARIABLE */}
				<TabsContent value="word" className="flex-1 flex flex-col justify-between pt-3 pb-2 gap-4">
					{!data.wordState ? (
						<p className="text-center text-sm text-zinc-500 my-auto">
							No hay palabra programada para hoy.
						</p>
					) : (
						<>
							<div className="text-center space-y-1 px-4">
								<p className="text-xs text-zinc-400">
									Palabra de <span className="font-bold text-zinc-200">{data.wordState.length} letras</span>
								</p>
								{data.wordState.hint && (
									<span className="inline-block text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-0.5 rounded-full">
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
									<div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-1">
										<p className="text-xs text-zinc-400">
											{data.wordState.status === 'won' ? '¡Adivinada!' : 'La palabra era:'}
										</p>
										<p className="text-xl font-extrabold tracking-widest text-emerald-400">
											{data.wordState.solution}
										</p>
										<p className="text-xs text-zinc-400">Puntos hoy: {data.wordState.score}</p>
									</div>
									{!data.user && (
										<Button
											variant="outline"
											onClick={() => setAuthOpen(true)}
											className="w-full border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40"
										>
											Inicia sesión para entrar al Ranking
										</Button>
									)}
									<Button onClick={() => handleShare('word')} className="w-full gap-2 font-semibold">
										<Share2 className="w-4 h-4" />
										{copied ? '¡Copiado para WhatsApp!' : 'Compartir resultado'}
									</Button>
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

				{/* TAB 2: FRASE ESTILO AHORCADO */}
				<TabsContent value="phrase" className="flex-1 flex flex-col justify-between pt-4 pb-2 gap-4">
					{!data.phraseState ? (
						<p className="text-center text-sm text-zinc-500 my-auto">
							No hay frase programada para hoy.
						</p>
					) : (
						<>
							<div className="my-auto">
								<PhraseBoard
									maskedChars={data.phraseState.maskedChars}
									wrongLetters={data.phraseState.wrongLetters}
									hint={data.phraseState.hint}
								/>
							</div>

							{data.phraseState.status !== 'playing' ? (
								<div className="px-4 py-3 text-center space-y-3">
									<div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-1">
										<p className="text-xs text-zinc-400">
											{data.phraseState.status === 'won' ? '¡Frase completada!' : 'La frase era:'}
										</p>
										<p className="text-base font-extrabold tracking-wide text-emerald-400">
											{data.phraseState.solution}
										</p>
										<p className="text-xs text-zinc-400">Puntos hoy: {data.phraseState.score}</p>
									</div>
									{!data.user && (
										<Button
											variant="outline"
											onClick={() => setAuthOpen(true)}
											className="w-full border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40"
										>
											Inicia sesión para entrar al Ranking
										</Button>
									)}
									<Button onClick={() => handleShare('phrase')} className="w-full gap-2 font-semibold">
										<Share2 className="w-4 h-4" />
										{copied ? '¡Copiado para WhatsApp!' : 'Compartir resultado'}
									</Button>
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
				<TabsContent value="ranking" className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
					{!data.user && (
						<div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center space-y-2.5">
							<p className="text-sm font-semibold text-zinc-100">
								¿Quieres aparecer en la tabla del Squad?
							</p>
							<p className="text-xs text-zinc-400">
								Inicia sesión con tu correo y elige tu apodo. Nunca mostraremos tu correo en la tabla.
							</p>
							<Button onClick={() => setAuthOpen(true)} size="sm" className="w-full font-semibold">
								Iniciar sesión / Registrarme
							</Button>
						</div>
					)}

					{data.leaderboard.length === 0 ? (
						<p className="text-center text-xs text-zinc-500 py-8">
							Aún no hay jugadores registrados en el ranking.
						</p>
					) : (
						data.leaderboard.map((player, index) => {
							const isMe = data.user?.id === player.id;
							return (
								<div
									key={player.id}
									className={`flex items-center justify-between p-3 rounded-xl border ${
										isMe
											? 'bg-zinc-900 border-emerald-500/50'
											: 'bg-zinc-900/40 border-zinc-800/80'
									}`}
								>
									<div className="flex items-center gap-3">
										<span
											className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
												index === 0
													? 'bg-amber-400 text-zinc-950'
													: index === 1
														? 'bg-zinc-300 text-zinc-950'
														: index === 2
															? 'bg-amber-700 text-white'
															: 'bg-zinc-800 text-zinc-400'
											}`}
										>
											{index + 1}
										</span>
										<div>
											<p className="text-sm font-semibold">
												{player.name}{' '}
												{isMe && <span className="text-xs text-emerald-400">(Tú)</span>}
											</p>
											<p className="text-xs text-zinc-500">
												{player.gamesWon} ganadas · Racha: {player.currentStreak}
											</p>
										</div>
									</div>
									<div className="text-right">
										<p className="text-sm font-extrabold text-zinc-100">{player.totalPoints} pts</p>
									</div>
								</div>
							);
						})
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}