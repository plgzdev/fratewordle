'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	getInitialGameData,
	getLeaderboardsOnly,
	solvePhraseGuess,
	submitPhraseLetter,
	submitWordGuess,
	syncGuestProgress,
	updateDisplayName
} from '@/app/actions/game';
import { authClient } from '@/lib/auth-client';
import { buildPhraseShareText, buildWordShareText, type LetterState } from '@/lib/share';
import { WordBoard } from './word-board';
import { PhraseBoard } from './phrase-board';
import { Keyboard } from './keyboard';
import { AuthScreen } from './auth-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '@/components/ui/dialog';
import {
	Award,
	CheckCircle2,
	Copy,
	Crown,
	Flame,
	KeyRound,
	Lock,
	LogIn,
	LogOut,
	Mail,
	MessageCircle,
	Pencil,
	Star,
	Trophy,
	User,
	UserPen
} from 'lucide-react';

type InitialData = Awaited<ReturnType<typeof getInitialGameData>>;
type GameStatus = 'playing' | 'won' | 'lost';

export function GameShell({ initialData }: { initialData: InitialData }) {
	const [data, setData] = useState<InitialData>(initialData);
	const [activeTab, setActiveTab] = useState<'word' | 'phrase' | 'ranking'>('word');
	const [rankingPeriod, setRankingPeriod] = useState<
		'daily' | 'weekly' | 'allTime' | 'streaks'
	>('daily');
	const [streakMode, setStreakMode] = useState<'active' | 'best'>('active');
	const [currentGuess, setCurrentGuess] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [toastMsg, setToastMsg] = useState<string | null>(null);
	const [shake, setShake] = useState(false);
	const [copied, setCopied] = useState(false);
	const [logoutOpen, setLogoutOpen] = useState(false);

	// Modal de login opcional, perfil de usuario y resolver frase completa
	const [authOpen, setAuthOpen] = useState(false);
	const [profileOpen, setProfileOpen] = useState(false);
	const [nameInput, setNameInput] = useState(initialData.user?.name ?? '');
	const [savingName, setSavingName] = useState(false);

	// Cambio de correo electrónico
	const [editingEmail, setEditingEmail] = useState(false);
	const [newEmailInput, setNewEmailInput] = useState('');
	const [savingEmail, setSavingEmail] = useState(false);
	const [emailError, setEmailError] = useState<string | null>(null);
	const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

	// Cambio de contraseña dentro del perfil + Modal independiente de Recuperar Contraseña
	const [showPasswordForm, setShowPasswordForm] = useState(false);
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [changingPass, setChangingPass] = useState(false);
	const [passError, setPassError] = useState<string | null>(null);
	const [passSuccess, setPassSuccess] = useState<string | null>(null);

	// Modal dedicado para recuperar contraseña por OTP
	const [recoverOpen, setRecoverOpen] = useState(false);
	const [recoverOtp, setRecoverOtp] = useState('');
	const [recoverNewPassword, setRecoverNewPassword] = useState('');
	const [sendingRecoverOtp, setSendingRecoverOtp] = useState(false);
	const [recoverLoading, setRecoverLoading] = useState(false);
	const [recoverError, setRecoverError] = useState<string | null>(null);
	const [recoverInfo, setRecoverInfo] = useState<string | null>(null);

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

	// Refrescar ranking solo al entrar a la pestaña Ranking
	const handleTabChange = useCallback((nextTab: string) => {
		const tab = nextTab as 'word' | 'phrase' | 'ranking';
		setActiveTab(tab);
		if (tab === 'ranking') {
			getLeaderboardsOnly().then((leaderboards) => {
				setData((prev) => ({ ...prev, leaderboards }));
			});
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

	// Sincronizar automáticamente cualquier progreso de invitado pendiente al iniciar sesión
	useEffect(() => {
		if (!data.user) return;

		const wordDate = data.wordState?.dateStr;
		const phraseDate = data.phraseState?.dateStr;

		const rawWord = wordDate ? localStorage.getItem(`fws_word_${wordDate}`) : null;
		const rawPhrase = phraseDate ? localStorage.getItem(`fws_phrase_${phraseDate}`) : null;

		if (!rawWord && !rawPhrase) return;

		let wordGuesses: string[] | undefined;
		let phraseGuesses: string[] | undefined;

		if (rawWord) {
			try {
				const parsed = JSON.parse(rawWord);
				if (Array.isArray(parsed.guesses) && parsed.guesses.length > 0) {
					wordGuesses = parsed.guesses;
				}
			} catch {}
		}

		if (rawPhrase) {
			try {
				const parsed = JSON.parse(rawPhrase);
				const list = parsed.rawGuesses ?? parsed.guessedLetters;
				if (Array.isArray(list) && list.length > 0) {
					phraseGuesses = list;
				}
			} catch {}
		}

		if (!wordGuesses && !phraseGuesses) {
			if (wordDate) localStorage.removeItem(`fws_word_${wordDate}`);
			if (phraseDate) localStorage.removeItem(`fws_phrase_${phraseDate}`);
			return;
		}

		let cancelled = false;

		(async () => {
			showToast('Guardando tu progreso de hoy...');
			const res = await syncGuestProgress({
				dateStr: wordDate ?? phraseDate,
				wordGuesses,
				phraseGuesses
			});

			if (!cancelled && res && 'ok' in res) {
				if (wordDate) localStorage.removeItem(`fws_word_${wordDate}`);
				if (phraseDate) localStorage.removeItem(`fws_phrase_${phraseDate}`);
				await refreshData();
				showToast('¡Progreso guardado en tu cuenta!');
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [data.user, data.wordState?.dateStr, data.phraseState?.dateStr, refreshData, showToast]);

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
				setData((prev) => ({
					...prev,
					user: prev.user && res.userStats ? { ...prev.user, ...res.userStats } : prev.user,
					wordState: prev.wordState ? { ...prev.wordState, ...updatedState } : null
				}));

				if (!data.user) {
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
		[currentGuess, data.user, data.wordState, showToast, submitting]
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
				const combinedWrongLetters = data.user
					? res.wrongLetters
					: [...res.wrongLetters, ...Array(previousWrongResolutions).fill('✕')];
				const lostByResolutions =
					!data.user && res.status === 'playing' && combinedWrongLetters.length >= 6;
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

				setData((prev) => ({
					...prev,
					user: prev.user && res.userStats ? { ...prev.user, ...res.userStats } : prev.user,
					phraseState: prev.phraseState ? { ...prev.phraseState, ...updatedState } : null
				}));

				if (!data.user) {
					let existingRawGuesses: string[] = [];
					try {
						const prevSaved = localStorage.getItem(`fws_phrase_${ps.dateStr}`);
						if (prevSaved) {
							const parsed = JSON.parse(prevSaved);
							existingRawGuesses = parsed.rawGuesses ?? parsed.guessedLetters ?? [];
						}
					} catch {}

					localStorage.setItem(
						`fws_phrase_${ps.dateStr}`,
						JSON.stringify({
							...updatedState,
							rawGuesses: [...existingRawGuesses, key]
						})
					);
				}

				if (finalStatus === 'won') showToast(`¡Frase resuelta! +${res.score} pts`);
				else if (finalStatus === 'lost') showToast('Sin vidas hoy');
			}
		},
		[data.phraseState, data.user, showToast, submitting]
	);

	async function handleSolvePhraseSubmit(e: React.FormEvent) {
		e.preventDefault();
		const ps = data.phraseState;
		if (!ps || ps.status !== 'playing' || submitting || !solveInput.trim()) return;

		setSubmitting(true);
		const guestWrongResolutions = ps.wrongLetters.filter((l) => l === '✕').length;
		const submittedPhrase = solveInput.trim();
		const res = await solvePhraseGuess(submittedPhrase, ps.guessedLetters, guestWrongResolutions);
		setSubmitting(false);

		if ('ok' in res && res.ok) {
			setSolveInput('');
			setSolveOpen(false);

			const updatedWrongResolutions = guestWrongResolutions + (res.isCorrect ? 0 : 1);
			const updatedState = {
				maskedChars: res.maskedChars,
				guessedLetters: res.guessedLetters,
				wrongLetters: data.user
					? res.wrongLetters
					: [...res.wrongLetters, ...Array(updatedWrongResolutions).fill('✕')],
				status: res.status as GameStatus,
				score: res.score,
				solution: res.solution
			};

			setData((prev) => ({
				...prev,
				user: prev.user && res.userStats ? { ...prev.user, ...res.userStats } : prev.user,
				phraseState: prev.phraseState ? { ...prev.phraseState, ...updatedState } : null
			}));

			if (!data.user) {
				let existingRawGuesses: string[] = ps.guessedLetters;
				try {
					const prevSaved = localStorage.getItem(`fws_phrase_${ps.dateStr}`);
					if (prevSaved) {
						const parsed = JSON.parse(prevSaved);
						existingRawGuesses = parsed.rawGuesses ?? parsed.guessedLetters ?? ps.guessedLetters;
					}
				} catch {}

				localStorage.setItem(
					`fws_phrase_${ps.dateStr}`,
					JSON.stringify({
						...updatedState,
						rawGuesses: [...existingRawGuesses, `SOLVE:${submittedPhrase}`]
					})
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
			if (
				profileOpen ||
				recoverOpen ||
				authOpen ||
				solveOpen ||
				logoutOpen ||
				activeTab === 'ranking'
			)
				return;
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
	}, [
		activeTab,
		authOpen,
		handlePhraseKey,
		handleWordKey,
		logoutOpen,
		profileOpen,
		recoverOpen,
		solveOpen
	]);

	function getShareText(mode: 'word' | 'phrase') {
		const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

		if (mode === 'word' && data.wordState) {
			return buildWordShareText({
				dayNumber: data.wordState.id,
				evaluations: data.wordState.evaluations,
				won: data.wordState.status === 'won',
				score: data.wordState.score,
				playerName: data.user?.name,
				streak: data.user?.currentStreak,
				appUrl
			});
		}

		if (mode === 'phrase' && data.phraseState) {
			return buildPhraseShareText({
				dayNumber: data.phraseState.id,
				wrongCount: data.phraseState.wrongLetters.length,
				won: data.phraseState.status === 'won',
				score: data.phraseState.score,
				playerName: data.user?.name,
				streak: data.user?.currentStreak,
				appUrl
			});
		}

		return '';
	}

	async function handleCopyShare(mode: 'word' | 'phrase') {
		const text = getShareText(mode);
		if (!text) return;

		await navigator.clipboard.writeText(text);
		setCopied(true);
		showToast('¡Copiado al portapapeles!');
		setTimeout(() => setCopied(false), 2000);
	}

	function handleWhatsAppShare(mode: 'word' | 'phrase') {
		const text = getShareText(mode);
		if (!text) return;

		const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
		window.open(waUrl, '_blank', 'noopener,noreferrer');
	}

	async function handleSaveName(e: React.FormEvent) {
		e.preventDefault();
		if (savingName) return;
		setSavingName(true);
		const res = await updateDisplayName(nameInput);
		setSavingName(false);
		if ('ok' in res && res.ok && typeof res.name === 'string') {
			const updatedName = res.name;
			setData((prev) =>
				prev.user ? { ...prev, user: { ...prev.user, name: updatedName } } : prev
			);
			setNameInput(updatedName);
			showToast('Apodo actualizado');
		} else {
			showToast('El apodo debe tener al menos 2 letras');
		}
	}

	async function handleChangeEmail(e: React.FormEvent) {
		e.preventDefault();
		const cleanEmail = newEmailInput.trim().toLowerCase();
		if (!cleanEmail || !data.user || cleanEmail === data.user.email.toLowerCase()) return;

		setEmailError(null);
		setEmailSuccess(null);
		setSavingEmail(true);

		try {
			const res = await authClient.changeEmail({
				newEmail: cleanEmail,
				callbackURL: '/'
			});

			setSavingEmail(false);
			if (res.error) {
				setEmailError(res.error.message || 'No se pudo iniciar el cambio de correo.');
				return;
			}

			setEditingEmail(false);
			setNewEmailInput('');
			setEmailSuccess(`Te enviamos un enlace de confirmación a ${cleanEmail}.`);
		} catch {
			setSavingEmail(false);
			setEmailError('Ocurrió un error al solicitar el cambio de correo.');
		}
	}

	function resetProfileModalStates() {
		setEditingEmail(false);
		setNewEmailInput('');
		setEmailError(null);
		setEmailSuccess(null);
		setShowPasswordForm(false);
		setPassError(null);
		setPassSuccess(null);
		setCurrentPassword('');
		setNewPassword('');
	}

	async function handleChangePassword(e: React.FormEvent) {
		e.preventDefault();
		setPassError(null);
		setPassSuccess(null);

		if (newPassword.length < 6) {
			setPassError('La nueva contraseña debe tener al menos 6 caracteres.');
			return;
		}

		setChangingPass(true);
		try {
			const res = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: false
			});

			setChangingPass(false);
			if (res.error) {
				setPassError('La contraseña actual es incorrecta.');
				return;
			}

			setCurrentPassword('');
			setNewPassword('');
			setPassSuccess('¡Contraseña actualizada correctamente!');
		} catch {
			setChangingPass(false);
			setPassError('No se pudo actualizar la contraseña.');
		}
	}

	async function handleOpenRecoverModal() {
		if (!data.user?.email || sendingRecoverOtp) return;
		setPassError(null);
		setPassSuccess(null);
		setRecoverError(null);
		setRecoverInfo(null);
		setSendingRecoverOtp(true);

		try {
			const res = await authClient.forgetPassword.emailOtp({
				email: data.user.email
			});

			setSendingRecoverOtp(false);
			if (res.error) {
				setPassError('No se pudo enviar el código. Intenta en un momento.');
				return;
			}

			setRecoverOtp('');
			setRecoverNewPassword('');
			setRecoverInfo(`Te enviamos un código de 6 dígitos a ${data.user.email}`);
			setProfileOpen(false);
			resetProfileModalStates();
			setRecoverOpen(true);
		} catch {
			setSendingRecoverOtp(false);
			setPassError('Error al enviar el código al correo.');
		}
	}

	async function handleResendRecoverOtp() {
		if (!data.user?.email || sendingRecoverOtp) return;
		setRecoverError(null);
		setRecoverInfo(null);
		setSendingRecoverOtp(true);

		const res = await authClient.forgetPassword.emailOtp({
			email: data.user.email
		});

		setSendingRecoverOtp(false);
		if (res.error) {
			setRecoverError('Espera un momento antes de pedir otro código.');
		} else {
			setRecoverInfo('Nuevo código enviado a tu correo.');
		}
	}

	async function handleConfirmRecoverModal(e: React.FormEvent) {
		e.preventDefault();
		if (!data.user?.email || recoverLoading) return;
		setRecoverError(null);
		setRecoverInfo(null);
		setRecoverLoading(true);

		try {
			const res = await authClient.emailOtp.resetPassword({
				email: data.user.email,
				otp: recoverOtp.trim(),
				password: recoverNewPassword
			});

			setRecoverLoading(false);
			if (res.error) {
				setRecoverError('Código incorrecto, expirado o contraseña inválida.');
				return;
			}

			setRecoverOpen(false);
			setRecoverOtp('');
			setRecoverNewPassword('');
			showToast('¡Contraseña restablecida!');
		} catch {
			setRecoverLoading(false);
			setRecoverError('No se pudo restablecer la contraseña.');
		}
	}

	const currentUserStreak = data.user?.currentStreak ?? 0;

	const previousTitleMap: Record<'daily' | 'weekly', string> = {
		daily: 'Podio de Ayer',
		weekly: 'Podio Semana Pasada'
	};

	const currentTitleMap: Record<'daily' | 'weekly', string> = {
		daily: 'Tabla de Hoy',
		weekly: 'Tabla de Esta Semana'
	};

	return (
		<div className="h-dvh w-full overflow-hidden bg-retro-board text-[#292524] flex flex-col">
			{/* Header cálido estilo tablero clásico */}
			<header className="border-b-2 border-[#e6d8c3] bg-[#fffdf9]/90 backdrop-blur-md px-3 sm:px-4 py-2 flex items-center justify-between gap-2 max-w-lg w-full mx-auto shadow-xs shrink-0">
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
							<Dialog
								open={profileOpen}
								onOpenChange={(open) => {
									setProfileOpen(open);
									if (!open) resetProfileModalStates();
								}}
							>
								<DialogTrigger
									title="Mi Perfil"
									className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#f7eedb] border border-stone-300 text-stone-700 hover:bg-amber-100 transition-colors cursor-pointer"
								>
									<UserPen className="w-4 h-4" />
								</DialogTrigger>
								<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] w-[calc(100%-1.5rem)] max-w-[360px] rounded-2xl p-3.5 sm:p-5 max-h-[90dvh] overflow-y-auto overflow-x-hidden">
									<DialogHeader className="pr-6 text-left">
										<DialogTitle className="flex items-center gap-2 font-black text-sm sm:text-base min-w-0">
											<span className="w-7 h-7 shrink-0 rounded-lg bg-emerald-500 border-b-2 border-emerald-700 text-white text-xs font-black flex items-center justify-center">
												{data.user.name.charAt(0).toUpperCase()}
											</span>
											<span className="truncate">Mi Perfil del Squad</span>
										</DialogTitle>
									</DialogHeader>

									<div className="space-y-3.5 pt-1 min-w-0">
										{/* Correo de la cuenta con opción de editar */}
										<div className="space-y-2 min-w-0">
											{!editingEmail ? (
												<div className="flex items-center justify-between gap-2 bg-[#fdf8ee] border border-[#e6d8c3] rounded-xl px-2.5 py-2 text-xs text-stone-600 min-w-0">
													<div className="flex items-center gap-1.5 min-w-0 flex-1">
														<Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
														<span className="truncate font-medium block">
															{data.user.email}
														</span>
													</div>
													<button
														type="button"
														onClick={() => {
															setEditingEmail(true);
															setNewEmailInput('');
															setEmailError(null);
															setEmailSuccess(null);
														}}
														className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 shrink-0 cursor-pointer"
													>
														<Pencil className="w-3 h-3" />
														<span>Cambiar</span>
													</button>
												</div>
											) : (
												<form
													onSubmit={handleChangeEmail}
													className="bg-[#fdf8ee] border border-[#e6d8c3] rounded-xl p-2.5 space-y-2 min-w-0"
												>
													<div className="flex items-center justify-between gap-2">
														<span className="text-[11px] font-bold text-stone-600 truncate">
															Nuevo correo
														</span>
														<button
															type="button"
															onClick={() => {
																setEditingEmail(false);
																setEmailError(null);
															}}
															className="text-[11px] font-bold text-stone-400 hover:text-stone-700 shrink-0 cursor-pointer"
														>
															Cancelar
														</button>
													</div>
													<div className="flex gap-1.5 min-w-0">
														<Input
															type="email"
															required
															value={newEmailInput}
															onChange={(e) => setNewEmailInput(e.target.value)}
															placeholder="nuevo@correo.com"
															className="bg-white border-stone-300 text-[#292524] h-8 text-xs min-w-0 flex-1"
														/>
														<button
															type="submit"
															disabled={savingEmail || !newEmailInput.trim()}
															className="px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 border-b-2 border-emerald-700 text-white font-black text-xs disabled:opacity-40 cursor-pointer shrink-0"
														>
															{savingEmail ? '...' : 'Enviar'}
														</button>
													</div>
												</form>
											)}

											{emailError && (
												<p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 break-words">
													{emailError}
												</p>
											)}

											{emailSuccess && (
												<p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 break-words">
													{emailSuccess}
												</p>
											)}
										</div>

										{/* Estadísticas del jugador */}
										<div className="grid grid-cols-2 gap-1.5 sm:gap-2 min-w-0">
											<div className="bg-[#fdf8ee] border-2 border-b-4 border-[#e6d8c3] rounded-xl p-2 sm:p-2.5 flex items-center gap-2 min-w-0">
												<div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
													<Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-orange-500" />
												</div>
												<div className="min-w-0">
													<p className="text-xs sm:text-sm font-black leading-tight text-[#292524] truncate">
														{data.user.currentStreak}
													</p>
													<p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
														Racha actual
													</p>
												</div>
											</div>

											<div className="bg-[#fdf8ee] border-2 border-b-4 border-[#e6d8c3] rounded-xl p-2 sm:p-2.5 flex items-center gap-2 min-w-0">
												<div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
													<Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
												</div>
												<div className="min-w-0">
													<p className="text-xs sm:text-sm font-black leading-tight text-[#292524] truncate">
														{data.user.maxStreak}
													</p>
													<p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
														Mejor racha
													</p>
												</div>
											</div>

											<div className="bg-[#fdf8ee] border-2 border-b-4 border-[#e6d8c3] rounded-xl p-2 sm:p-2.5 flex items-center gap-2 min-w-0">
												<div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
													<Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-emerald-500" />
												</div>
												<div className="min-w-0">
													<p className="text-xs sm:text-sm font-black leading-tight text-[#292524] truncate">
														{data.user.totalPoints}
													</p>
													<p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
														Puntos totales
													</p>
												</div>
											</div>

											<div className="bg-[#fdf8ee] border-2 border-b-4 border-[#e6d8c3] rounded-xl p-2 sm:p-2.5 flex items-center gap-2 min-w-0">
												<div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
													<CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
												</div>
												<div className="min-w-0">
													<p className="text-xs sm:text-sm font-black leading-tight text-[#292524] truncate">
														{data.user.gamesWon}{' '}
														<span className="text-[10px] sm:text-xs font-semibold text-stone-400">
															/ {data.user.gamesPlayed}
														</span>
													</p>
													<p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
														Ganadas
													</p>
												</div>
											</div>
										</div>

										{/* Editar Apodo */}
										<form
											onSubmit={handleSaveName}
											className="space-y-2 pt-2 border-t border-[#e6d8c3] min-w-0"
										>
											<label className="text-xs font-bold text-stone-600 flex items-center gap-1.5">
												<User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
												<span>Apodo en el Ranking</span>
											</label>
											<div className="flex gap-1.5 min-w-0">
												<Input
													value={nameInput}
													onChange={(e) => setNameInput(e.target.value)}
													maxLength={24}
													placeholder="Tu apodo"
													className="bg-[#fdf8ee] border-stone-300 text-[#292524] h-9 text-xs sm:text-sm min-w-0 flex-1"
												/>
												<button
													type="submit"
													disabled={
														savingName ||
														nameInput.trim().length < 2 ||
														nameInput.trim() === data.user.name
													}
													className="px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-xs transition-all disabled:opacity-40 cursor-pointer shrink-0"
												>
													{savingName ? '...' : 'Guardar'}
												</button>
											</div>
										</form>

										{/* Sección Cambiar Contraseña */}
										<div className="pt-2 border-t border-[#e6d8c3] min-w-0">
											{!showPasswordForm ? (
												<button
													type="button"
													onClick={() => {
														setShowPasswordForm(true);
														setPassError(null);
														setPassSuccess(null);
													}}
													className="w-full py-2 px-3 rounded-xl bg-[#f7eedb] hover:bg-amber-100/70 border border-[#e6d8c3] text-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
												>
													<KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
													<span>Cambiar contraseña</span>
												</button>
											) : (
												<form onSubmit={handleChangePassword} className="space-y-2.5 min-w-0">
													<div className="flex items-center justify-between gap-2">
														<span className="text-xs font-bold text-stone-600 flex items-center gap-1.5 truncate">
															<Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
															<span className="truncate">Cambiar contraseña</span>
														</span>
														<button
															type="button"
															onClick={() => {
																setShowPasswordForm(false);
																setPassError(null);
																setPassSuccess(null);
																setCurrentPassword('');
																setNewPassword('');
															}}
															className="text-[11px] font-bold text-stone-400 hover:text-stone-700 shrink-0 cursor-pointer"
														>
															Cancelar
														</button>
													</div>

													<Input
														type="password"
														required
														value={currentPassword}
														onChange={(e) => setCurrentPassword(e.target.value)}
														placeholder="Contraseña actual"
														className="bg-[#fdf8ee] border-stone-300 text-[#292524] h-9 text-xs"
													/>
													<Input
														type="password"
														required
														minLength={6}
														value={newPassword}
														onChange={(e) => setNewPassword(e.target.value)}
														placeholder="Nueva contraseña (mín. 6)"
														className="bg-[#fdf8ee] border-stone-300 text-[#292524] h-9 text-xs"
													/>

													<div className="flex justify-end">
														<button
															type="button"
															disabled={sendingRecoverOtp}
															onClick={handleOpenRecoverModal}
															className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 text-right cursor-pointer disabled:opacity-50"
														>
															{sendingRecoverOtp
																? 'Enviando código...'
																: '¿La olvidaste? Recuperar por correo'}
														</button>
													</div>

													{passError && (
														<p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 break-words">
															{passError}
														</p>
													)}

													{passSuccess && (
														<p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 break-words">
															{passSuccess}
														</p>
													)}

													<button
														type="submit"
														disabled={changingPass}
														className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 border-2 border-b-4 border-amber-600 text-amber-950 font-black text-xs transition-all disabled:opacity-50 cursor-pointer"
													>
														{changingPass ? 'Actualizando...' : 'Actualizar contraseña'}
													</button>
												</form>
											)}
										</div>
									</div>
								</DialogContent>
							</Dialog>

							<button
								type="button"
								onClick={() => setLogoutOpen(true)}
								title="Cerrar sesión"
								className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-stone-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
							>
								<LogOut className="w-4 h-4" />
							</button>
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

			{/* Modal independiente de Recuperar Contraseña */}
			<Dialog
				open={recoverOpen}
				onOpenChange={(open) => {
					setRecoverOpen(open);
					if (!open) {
						setRecoverOtp('');
						setRecoverNewPassword('');
						setRecoverError(null);
						setRecoverInfo(null);
					}
				}}
			>
				<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] w-[calc(100%-1.5rem)] max-w-[340px] rounded-2xl p-0 overflow-hidden">
					<DialogHeader className="sr-only">
						<DialogTitle>Recuperar contraseña</DialogTitle>
					</DialogHeader>
					<div className="p-4 sm:p-5 space-y-3.5 bg-[#fffdf9] text-[#292524] min-w-0">
						<div className="text-center space-y-1">
							<div className="w-10 h-10 mx-auto rounded-2xl bg-amber-400 border-2 border-b-4 border-amber-600 text-amber-950 font-black flex items-center justify-center shadow-xs">
								<KeyRound className="w-5 h-5" />
							</div>
							<h2 className="text-base font-black tracking-tight pt-1">Nueva contraseña</h2>
							<p className="text-xs text-stone-500 break-all">
								Código enviado a{' '}
								<span className="font-bold text-[#292524]">{data.user?.email}</span>
							</p>
						</div>

						<form onSubmit={handleConfirmRecoverModal} className="space-y-3">
							<div className="space-y-1">
								<label className="text-xs font-bold text-stone-600">Código de 6 dígitos</label>
								<Input
									type="text"
									inputMode="numeric"
									autoComplete="one-time-code"
									required
									maxLength={6}
									value={recoverOtp}
									onChange={(e) => setRecoverOtp(e.target.value.replace(/\D/g, ''))}
									placeholder="000000"
									className="text-center text-lg font-black tracking-[0.25em] sm:tracking-[0.35em] bg-[#fdf8ee] border-stone-300 text-[#292524] h-11"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-bold text-stone-600">Nueva contraseña</label>
								<div className="relative">
									<Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
									<Input
										type="password"
										required
										minLength={6}
										value={recoverNewPassword}
										onChange={(e) => setRecoverNewPassword(e.target.value)}
										placeholder="Mínimo 6 caracteres"
										className="pl-9 bg-[#fdf8ee] border-stone-300 text-[#292524]"
									/>
								</div>
							</div>

							{recoverInfo && (
								<p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 break-words">
									{recoverInfo}
								</p>
							)}

							{recoverError && (
								<p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 break-words">
									{recoverError}
								</p>
							)}

							<button
								type="submit"
								disabled={
									recoverLoading || recoverOtp.length < 6 || recoverNewPassword.length < 6
								}
								className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer"
							>
								{recoverLoading ? 'Guardando...' : 'Guardar nueva contraseña'}
							</button>

							<div className="flex items-center justify-between gap-2 pt-1 text-xs">
								<button
									type="button"
									onClick={() => {
										setRecoverOpen(false);
										setProfileOpen(true);
									}}
									className="font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
								>
									← Volver
								</button>
								<button
									type="button"
									disabled={sendingRecoverOtp}
									onClick={handleResendRecoverOtp}
									className="font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer disabled:opacity-50"
								>
									{sendingRecoverOtp ? 'Enviando...' : 'Reenviar código'}
								</button>
							</div>
						</form>
					</div>
				</DialogContent>
			</Dialog>

			{/* Modal de Login Opcional */}
			<Dialog open={authOpen} onOpenChange={setAuthOpen}>
				<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] w-[calc(100%-1.5rem)] max-w-[340px] rounded-2xl p-0 overflow-hidden">
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

			{/* Modal para Escribir Frase Completa */}
			<Dialog open={solveOpen} onOpenChange={setSolveOpen}>
				<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] w-[calc(100%-1.5rem)] max-w-sm rounded-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-emerald-700 font-black text-sm sm:text-base">
							<span className="w-7 h-7 rounded-lg bg-emerald-500 border-b-2 border-emerald-700 text-white flex items-center justify-center shrink-0">
								<Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
							</span>
							Escribir frase completa
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
							className="bg-[#fdf8ee] border-2 border-stone-300 focus-visible:ring-emerald-500 uppercase font-bold text-[#292524]"
						/>
						<button
							type="submit"
							disabled={submitting || !solveInput.trim()}
							className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 active:border-b-2 border-2 border-b-4 border-emerald-700 text-white font-black text-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer"
						>
							{submitting ? 'Comprobando...' : 'Comprobar frase'}
						</button>
					</form>
				</DialogContent>
			</Dialog>

			{/* Modal de confirmación para Cerrar Sesión */}
			<Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
				<DialogContent className="bg-[#fffdf9] border-2 border-[#e6d8c3] text-[#292524] w-[calc(100%-1.5rem)] max-w-xs rounded-2xl">
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
				onValueChange={handleTabChange}
				className="flex-1 min-h-0 flex flex-col max-w-lg w-full mx-auto"
			>
				<div className="px-3 sm:px-4 pt-2 w-full shrink-0">
					<TabsList className="grid grid-cols-3 w-full bg-[#f7eedb] border-2 border-[#e6d8c3] p-1 rounded-2xl h-10">
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
				<TabsContent value="word" className="flex-1 min-h-0 flex flex-col overflow-y-auto py-2">
					{!data.wordState ? (
						<p className="text-center text-sm text-stone-500 my-auto">
							No hay palabra programada para hoy.
						</p>
					) : (
						<div className="my-auto w-full flex flex-col items-center gap-2.5 sm:gap-4">
							{data.wordState.hint && (
								<span className="inline-block text-xs font-semibold bg-amber-100 border border-amber-300 text-amber-900 px-3 py-0.5 rounded-full shadow-xs">
									Pista: {data.wordState.hint}
								</span>
							)}

							<WordBoard
								length={data.wordState.length}
								guesses={data.wordState.guesses}
								evaluations={data.wordState.evaluations}
								currentGuess={currentGuess}
								isPlaying={data.wordState.status === 'playing'}
								shake={shake}
							/>

							{data.wordState.status !== 'playing' ? (
								<div className="w-full px-4 py-2 text-center space-y-2.5">
									<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-4 space-y-1 shadow-sm">
										<p className="text-xs font-bold text-stone-500">
											{data.wordState.status === 'won' ? '¡Adivinada!' : 'La palabra era:'}
										</p>
										<p
											className={`text-2xl font-black tracking-widest ${
												data.wordState.status === 'won' ? 'text-emerald-600' : 'text-rose-600'
											}`}
										>
											{data.wordState.solution}
										</p>
										<p className="text-xs font-semibold text-stone-500">
											Puntos hoy: {data.wordState.score}
										</p>
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

									<div className="grid grid-cols-2 gap-2 pt-1">
										<button
											type="button"
											onClick={() => handleWhatsAppShare('word')}
											className="py-2.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 active:border-b-2 border-2 border-b-4 border-emerald-700 text-white font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
										>
											<MessageCircle className="w-4 h-4 shrink-0" />
											<span>Compartir por WhatsApp</span>
										</button>

										<button
											type="button"
											onClick={() => handleCopyShare('word')}
											className="py-2.5 px-2 rounded-xl bg-[#fffdf9] hover:bg-stone-100 active:translate-y-0.5 active:border-b-2 border-2 border-b-4 border-stone-300 text-stone-700 font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
										>
											<Copy className="w-3.5 h-3.5 shrink-0" />
											<span>{copied ? '¡Copiado!' : 'Copiar en portapapeles'}</span>
										</button>
									</div>
								</div>
							) : (
								<Keyboard
									mode="word"
									letterStatuses={wordLetterStatuses}
									disabled={submitting}
									onKey={handleWordKey}
								/>
							)}
						</div>
					)}
				</TabsContent>

				{/* TAB 2: FRASE ESTILO RULETA DE LA FORTUNA */}
				<TabsContent value="phrase" className="flex-1 min-h-0 flex flex-col overflow-y-auto py-2">
					{!data.phraseState ? (
						<p className="text-center text-sm text-stone-500 my-auto">
							No hay frase programada para hoy.
						</p>
					) : (
						<div className="my-auto w-full flex flex-col items-center gap-3 sm:gap-5">
							<div className="w-full space-y-3 sm:space-y-4">
								<PhraseBoard
									maskedChars={data.phraseState.maskedChars}
									wrongLetters={data.phraseState.wrongLetters}
									hint={data.phraseState.hint}
									status={data.phraseState.status}
								/>

								{data.phraseState.status === 'playing' && (
									<div className="flex justify-center px-4">
										<button
											type="button"
											onClick={() => setSolveOpen(true)}
											className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 active:border-b-2 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-sm border-2 border-b-4 border-emerald-700 transition-all cursor-pointer select-none"
										>
											<Pencil className="w-4 h-4 stroke-[2.75] text-white" />
											Escribir frase completa
										</button>
									</div>
								)}
							</div>

							{data.phraseState.status !== 'playing' ? (
								<div className="w-full px-4 py-2 text-center space-y-2.5">
									<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-4 space-y-1 shadow-sm">
										<p className="text-xs font-bold text-stone-500">
											{data.phraseState.status === 'won' ? '¡Frase completada!' : 'La frase era:'}
										</p>
										<p
											className={`text-base font-black tracking-wide ${
												data.phraseState.status === 'won' ? 'text-emerald-600' : 'text-rose-600'
											}`}
										>
											{data.phraseState.solution}
										</p>
										<p className="text-xs font-semibold text-stone-500">
											Puntos hoy: {data.phraseState.score}
										</p>
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

									<div className="grid grid-cols-2 gap-2 pt-1">
										<button
											type="button"
											onClick={() => handleWhatsAppShare('phrase')}
											className="py-2.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 active:border-b-2 border-2 border-b-4 border-emerald-700 text-white font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
										>
											<MessageCircle className="w-4 h-4 shrink-0" />
											<span>Compartir por WhatsApp</span>
										</button>

										<button
											type="button"
											onClick={() => handleCopyShare('phrase')}
											className="py-2.5 px-2 rounded-xl bg-[#fffdf9] hover:bg-stone-100 active:translate-y-0.5 active:border-b-2 border-2 border-b-4 border-stone-300 text-stone-700 font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
										>
											<Copy className="w-3.5 h-3.5 shrink-0" />
											<span>{copied ? '¡Copiado!' : 'Copiar en portapapeles'}</span>
										</button>
									</div>
								</div>
							) : (
								<Keyboard
									mode="phrase"
									letterStatuses={phraseLetterStatuses}
									disabled={submitting}
									onKey={handlePhraseKey}
								/>
							)}
						</div>
					)}
				</TabsContent>

				{/* TAB 3: RANKING DEL SQUAD (HOY / SEMANA / HISTÓRICO / RACHAS) */}
				<TabsContent value="ranking" className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-3">
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

					{/* Selector Hoy / Semana / Histórico / Rachas */}
					<div className="grid grid-cols-4 bg-[#f7eedb] border-2 border-[#e6d8c3] p-1 rounded-xl text-[11px] sm:text-xs font-extrabold">
						{(
							[
								{ id: 'daily', label: 'Hoy' },
								{ id: 'weekly', label: 'Semana' },
								{ id: 'allTime', label: 'Histórico' },
								{ id: 'streaks', label: 'Rachas' }
							] as const
						).map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setRankingPeriod(tab.id)}
								className={`py-1.5 rounded-lg transition-all cursor-pointer truncate px-1 ${
									rankingPeriod === tab.id
										? 'bg-amber-400 text-amber-950 shadow-xs'
										: 'text-stone-600 hover:text-stone-900'
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>

					{rankingPeriod === 'streaks' ? (
						(() => {
							const activeList =
								data.leaderboards?.streaks?.active ??
								[...(data.leaderboards?.allTime ?? [])]
									.filter((u) => u.currentStreak > 0)
									.sort((a, b) => b.currentStreak - a.currentStreak || b.maxStreak - a.maxStreak);

							const bestList =
								data.leaderboards?.streaks?.best ??
								[...(data.leaderboards?.allTime ?? [])]
									.filter((u) => u.maxStreak > 0)
									.sort((a, b) => b.maxStreak - a.maxStreak || b.currentStreak - a.currentStreak);

							return (
								<div className="space-y-3">
									{/* Podio Top 3 Mejor Racha Histórica */}
									<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-3 space-y-2.5 shadow-xs">
										<div className="flex items-center justify-between">
											<span className="inline-flex items-center gap-1.5 text-xs font-black text-[#292524]">
												<Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
												Récord de Rachas Históricas
											</span>
											<span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
												Top 3
											</span>
										</div>

										{bestList.length === 0 ? (
											<p className="text-center text-[11px] text-stone-400 py-2">
												Aún no hay rachas registradas en el Squad.
											</p>
										) : (
											<div className="grid grid-cols-3 gap-1.5">
												{bestList.slice(0, 3).map((player, idx) => {
													const isMe = data.user?.id === player.id;
													const badgeStyle =
														idx === 0
															? 'bg-amber-400 border-amber-600 text-amber-950'
															: idx === 1
																? 'bg-stone-200 border-stone-400 text-stone-800'
																: 'bg-orange-300 border-orange-500 text-orange-950';

													return (
														<div
															key={player.id}
															className={`rounded-xl border p-2 text-center flex flex-col items-center justify-between gap-1 min-w-0 ${
																isMe
																	? 'bg-orange-50/90 border-orange-400'
																	: 'bg-[#fdf8ee] border-[#e6d8c3]'
															}`}
														>
															<span
																className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border ${badgeStyle}`}
															>
																{idx + 1}
															</span>
															<p className="text-xs font-extrabold text-[#292524] truncate w-full">
																{player.name}
															</p>
															<p className="text-[11px] font-black text-orange-600 inline-flex items-center gap-0.5">
																<Flame className="w-3 h-3 fill-orange-500" />
																{player.maxStreak} {player.maxStreak === 1 ? 'día' : 'días'}
															</p>
														</div>
													);
												})}
											</div>
										)}
									</div>

									{/* Conmutador Racha Activa vs Mejor Racha */}
									<div className="grid grid-cols-2 bg-[#f7eedb] border border-[#e6d8c3] p-1 rounded-xl text-[11px] font-extrabold">
										<button
											type="button"
											onClick={() => setStreakMode('active')}
											className={`py-1 rounded-lg transition-all cursor-pointer ${
												streakMode === 'active'
													? 'bg-[#fffdf9] text-[#292524] shadow-xs'
													: 'text-stone-500 hover:text-stone-800'
											}`}
										>
											🔥 Rachas Activas
										</button>
										<button
											type="button"
											onClick={() => setStreakMode('best')}
											className={`py-1 rounded-lg transition-all cursor-pointer ${
												streakMode === 'best'
													? 'bg-[#fffdf9] text-[#292524] shadow-xs'
													: 'text-stone-500 hover:text-stone-800'
											}`}
										>
											🏆 Mejor Racha
										</button>
									</div>

									{/* Lista de jugadores ordenados por racha */}
									{(() => {
										const list = streakMode === 'active' ? activeList : bestList;

										if (list.length === 0) {
											return (
												<p className="text-center text-xs text-stone-500 py-8">
													{streakMode === 'active'
														? 'Nadie tiene una racha activa hoy. ¡Gana hoy para iniciar la tuya!'
														: 'Aún no hay récords de rachas registrados.'}
												</p>
											);
										}

										return list.map((player, index) => {
											const isMe = data.user?.id === player.id;
											const streakValue =
												streakMode === 'active' ? player.currentStreak : player.maxStreak;

											return (
												<div
													key={player.id}
													className={`flex items-center justify-between p-3.5 rounded-2xl border-2 border-b-4 transition-colors ${
														isMe
															? 'bg-orange-50/80 border-orange-400 shadow-xs'
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
																{isMe && <span className="text-xs text-orange-600">(Tú)</span>}
															</p>
															<p className="text-xs text-stone-500 font-medium">
																Récord personal: {player.maxStreak}{' '}
																{player.maxStreak === 1 ? 'día' : 'días'}
															</p>
														</div>
													</div>

													<div className="inline-flex items-center gap-1 bg-orange-100 border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full">
														<Flame className="w-4 h-4 fill-orange-500 text-orange-600" />
														<span className="text-sm font-black">{streakValue}</span>
													</div>
												</div>
											);
										});
									})()}
								</div>
							);
						})()
					) : (
						<>
							{/* Bloque superior: Récords en Histórico, o Podio Top 3 anterior + Récord en Hoy/Semana */}
							{rankingPeriod === 'allTime' ? (
								<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-3 space-y-2.5 shadow-xs">
									<div className="flex items-center justify-between">
										<span className="inline-flex items-center gap-1.5 text-xs font-black text-[#292524]">
											<Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
											Récords Históricos del Squad
										</span>
										<span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
											All-Time
										</span>
									</div>

									<div className="grid grid-cols-2 gap-2">
										{(
											[
												{ label: 'Mejor Día', rec: data.leaderboards?.records?.daily ?? null },
												{ label: 'Mejor Semana', rec: data.leaderboards?.records?.weekly ?? null }
											] as const
										).map((entry) => (
											<div
												key={entry.label}
												className="rounded-xl border bg-[#fdf8ee] border-[#e6d8c3] p-2.5 text-center flex flex-col items-center justify-between gap-1 min-w-0"
											>
												<span className="text-[10px] font-extrabold uppercase tracking-tight text-stone-500">
													{entry.label}
												</span>
												{entry.rec ? (
													<>
														<p className="text-xs font-extrabold text-[#292524] truncate w-full">
															{entry.rec.name}
														</p>
														<p className="text-[11px] font-black text-emerald-600">
															{entry.rec.totalPoints} pts
														</p>
													</>
												) : (
													<p className="text-[11px] text-stone-400 py-1">—</p>
												)}
											</div>
										))}
									</div>
								</div>
							) : (
								(() => {
									const prevTop3 = data.leaderboards?.previous?.[rankingPeriod] ?? [];
									const periodRecord = data.leaderboards?.records?.[rankingPeriod] ?? null;
									const recordLabelMap = {
										daily: 'Récord en 1 día',
										weekly: 'Récord en 1 semana'
									};

									return (
										<div className="bg-[#fffdf9] border-2 border-b-4 border-[#e6d8c3] rounded-2xl p-3 space-y-2.5 shadow-xs">
											<div className="flex items-center justify-between">
												<span className="inline-flex items-center gap-1.5 text-xs font-black text-[#292524]">
													<Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
													{previousTitleMap[rankingPeriod]}
												</span>
												<span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
													Top 3
												</span>
											</div>

											{prevTop3.length === 0 ? (
												<p className="text-center text-[11px] text-stone-400 py-1.5">
													Sin registros en ese periodo anterior.
												</p>
											) : (
												<div className="grid grid-cols-3 gap-1.5">
													{prevTop3.map((player, idx) => {
														const isMe = data.user?.id === player.id;
														const badgeStyle =
															idx === 0
																? 'bg-amber-400 border-amber-600 text-amber-950'
																: idx === 1
																	? 'bg-stone-200 border-stone-400 text-stone-800'
																	: 'bg-orange-300 border-orange-500 text-orange-950';

														return (
															<div
																key={player.id}
																className={`rounded-xl border p-2 text-center flex flex-col items-center justify-between gap-1 min-w-0 ${
																	isMe
																		? 'bg-emerald-50/90 border-emerald-400'
																		: 'bg-[#fdf8ee] border-[#e6d8c3]'
																}`}
															>
																<span
																	className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border ${badgeStyle}`}
																>
																	{idx + 1}
																</span>
																<p className="text-xs font-extrabold text-[#292524] truncate w-full">
																	{player.name}
																</p>
																<p className="text-[11px] font-black text-emerald-600">
																	{player.totalPoints} pts
																</p>
															</div>
														);
													})}
												</div>
											)}

											{periodRecord && (
												<div className="flex items-center justify-between gap-2 pt-2 border-t border-[#e6d8c3] text-[11px]">
													<span className="inline-flex items-center gap-1 font-bold text-stone-500">
														<Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
														{recordLabelMap[rankingPeriod]}:
													</span>
													<span className="font-black text-[#292524] truncate">
														{periodRecord.name}{' '}
														<span className="text-emerald-600">
															({periodRecord.totalPoints} pts)
														</span>
													</span>
												</div>
											)}
										</div>
									);
								})()
							)}

							{/* Tabla del periodo actual o Histórico Acumulado */}
							<div className="space-y-2">
								<p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 px-1">
									{rankingPeriod === 'allTime'
										? 'Clasificación Histórica Total'
										: currentTitleMap[rankingPeriod]}
								</p>

								{(() => {
									const activeBoard = data.leaderboards?.[rankingPeriod] ?? [];
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
													<p className="text-sm font-black text-emerald-600">
														{player.totalPoints} pts
													</p>
												</div>
											</div>
										);
									});
								})()}
							</div>
						</>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}