'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/ui/input';
import { KeyRound, Lock, Mail, User } from 'lucide-react';

interface AuthScreenProps {
	onSuccess: () => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
	const [isRegister, setIsRegister] = useState(false);
	const [step, setStep] = useState<'form' | 'otp' | 'forgot' | 'reset'>('form');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [otp, setOtp] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setInfo(null);
		setLoading(true);

		try {
			const cleanEmail = email.trim();

			if (isRegister) {
				const finalName = name.trim() || cleanEmail.split('@')[0];
				const res = await authClient.signUp.email({
					email: cleanEmail,
					password,
					name: finalName
				});

				if (res.error) {
					setError(res.error.message || 'No se pudo crear la cuenta.');
					setLoading(false);
					return;
				}

				setLoading(false);
				setStep('otp');
				setInfo('Te enviamos un código de 6 dígitos a tu correo.');
				return;
			}

			// Iniciar sesión directo con correo + contraseña
			const res = await authClient.signIn.email({
				email: cleanEmail,
				password
			});

			if (res.error) {
				// Si la cuenta existe pero nunca verificó el OTP al registrarse
				if (res.error.code === 'EMAIL_NOT_VERIFIED' || res.error.status === 403) {
					await authClient.emailOtp.sendVerificationOtp({
						email: cleanEmail,
						type: 'email-verification'
					});
					setLoading(false);
					setStep('otp');
					setInfo('Tu correo aún no está verificado. Te enviamos un código nuevo.');
					return;
				}

				setError('Correo o contraseña incorrectos.');
				setLoading(false);
				return;
			}

			setLoading(false);
			onSuccess();
		} catch {
			setError('Ocurrió un error al conectar. Intenta de nuevo.');
			setLoading(false);
		}
	}

	async function handleVerifyOtp(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setInfo(null);
		setLoading(true);

		try {
			const cleanEmail = email.trim();
			const res = await authClient.emailOtp.verifyEmail({
				email: cleanEmail,
				otp: otp.trim()
			});

			if (res.error) {
				setError('Código incorrecto o expirado.');
				setLoading(false);
				return;
			}

			// Iniciar sesión automáticamente tras verificar el correo
			await authClient.signIn.email({
				email: cleanEmail,
				password
			});

			setLoading(false);
			onSuccess();
		} catch {
			setError('No se pudo verificar el código.');
			setLoading(false);
		}
	}

	async function handleResendOtp() {
		setError(null);
		setInfo(null);
		setLoading(true);
		const res = await authClient.emailOtp.sendVerificationOtp({
			email: email.trim(),
			type: 'email-verification'
		});
		setLoading(false);
		if (res.error) {
			setError('Espera un momento antes de pedir otro código.');
		} else {
			setInfo('Nuevo código enviado a tu correo.');
		}
	}

	// Paso 1 de recuperación: pedir el código OTP al correo
	async function handleForgotSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setInfo(null);
		setLoading(true);

		try {
			const cleanEmail = email.trim();
			const res = await authClient.forgetPassword.emailOtp({
				email: cleanEmail
			});

			if (res.error) {
				setError(res.error.message || 'No se pudo enviar el código de recuperación.');
				setLoading(false);
				return;
			}

			setLoading(false);
			setOtp('');
			setNewPassword('');
			setStep('reset');
			setInfo('Si el correo está registrado, recibirás un código de 6 dígitos.');
		} catch {
			setError('Ocurrió un error al enviar el código. Intenta de nuevo.');
			setLoading(false);
		}
	}

	// Paso 2 de recuperación: confirmar código OTP + nueva contraseña
	async function handleResetSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setInfo(null);
		setLoading(true);

		try {
			const cleanEmail = email.trim();
			const res = await authClient.emailOtp.resetPassword({
				email: cleanEmail,
				otp: otp.trim(),
				password: newPassword
			});

			if (res.error) {
				setError('Código incorrecto, expirado o contraseña inválida.');
				setLoading(false);
				return;
			}

			// Iniciar sesión automáticamente con la nueva contraseña
			const signInRes = await authClient.signIn.email({
				email: cleanEmail,
				password: newPassword
			});

			setLoading(false);
			if (signInRes.error) {
				setStep('form');
				setIsRegister(false);
				setInfo('Contraseña actualizada. Ya puedes iniciar sesión.');
				return;
			}

			onSuccess();
		} catch {
			setError('No se pudo restablecer la contraseña.');
			setLoading(false);
		}
	}

	if (step === 'otp') {
		return (
			<div className="p-4 sm:p-5 space-y-3.5 bg-[#fffdf9] text-[#292524]">
				<div className="text-center space-y-1">
					<div className="w-10 h-10 mx-auto rounded-2xl bg-amber-400 border-2 border-b-4 border-amber-600 text-amber-950 font-black flex items-center justify-center shadow-xs">
						<KeyRound className="w-5 h-5" />
					</div>
					<h2 className="text-base font-black tracking-tight pt-1">Verifica tu correo</h2>
					<p className="text-xs text-stone-500">
						Ingresa el código enviado a <span className="font-bold text-[#292524]">{email}</span>
					</p>
				</div>

				<form onSubmit={handleVerifyOtp} className="space-y-3">
					<Input
						type="text"
						inputMode="numeric"
						autoComplete="one-time-code"
						required
						maxLength={6}
						value={otp}
						onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
						placeholder="000000"
						className="text-center text-xl font-black tracking-[0.4em] bg-[#fdf8ee] border-stone-300 text-[#292524] h-12"
					/>

					{info && (
						<p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
							{info}
						</p>
					)}

					{error && (
						<p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={loading || otp.length < 6}
						className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer"
					>
						{loading ? 'Verificando...' : 'Confirmar y entrar'}
					</button>

					<div className="flex items-center justify-between pt-1 text-xs">
						<button
							type="button"
							onClick={() => {
								setStep('form');
								setOtp('');
								setError(null);
								setInfo(null);
							}}
							className="font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
						>
							← Cambiar correo
						</button>
						<button
							type="button"
							disabled={loading}
							onClick={handleResendOtp}
							className="font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer disabled:opacity-50"
						>
							Reenviar código
						</button>
					</div>
				</form>
			</div>
		);
	}

	if (step === 'forgot') {
		return (
			<div className="p-4 sm:p-5 space-y-3.5 bg-[#fffdf9] text-[#292524]">
				<div className="text-center space-y-1">
					<div className="w-10 h-10 mx-auto rounded-2xl bg-amber-400 border-2 border-b-4 border-amber-600 text-amber-950 font-black flex items-center justify-center shadow-xs">
						<KeyRound className="w-5 h-5" />
					</div>
					<h2 className="text-base font-black tracking-tight pt-1">Recuperar contraseña</h2>
					<p className="text-xs text-stone-500">
						Escribe tu correo y te enviaremos un código para crear una nueva contraseña.
					</p>
				</div>

				<form onSubmit={handleForgotSubmit} className="space-y-3">
					<div className="space-y-1">
						<label className="text-xs font-bold text-stone-600">Correo electrónico</label>
						<div className="relative">
							<Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
							<Input
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="tu@correo.com"
								className="pl-9 bg-[#fdf8ee] border-stone-300 text-[#292524]"
							/>
						</div>
					</div>

					{error && (
						<p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer"
					>
						{loading ? 'Enviando código...' : 'Enviar código'}
					</button>

					<div className="pt-1 text-center text-xs">
						<button
							type="button"
							onClick={() => {
								setStep('form');
								setError(null);
								setInfo(null);
							}}
							className="font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
						>
							← Volver a iniciar sesión
						</button>
					</div>
				</form>
			</div>
		);
	}

	if (step === 'reset') {
		return (
			<div className="p-4 sm:p-5 space-y-3.5 bg-[#fffdf9] text-[#292524]">
				<div className="text-center space-y-1">
					<div className="w-10 h-10 mx-auto rounded-2xl bg-emerald-500 border-2 border-b-4 border-emerald-700 text-white font-black flex items-center justify-center shadow-xs">
						<Lock className="w-5 h-5" />
					</div>
					<h2 className="text-base font-black tracking-tight pt-1">Nueva contraseña</h2>
					<p className="text-xs text-stone-500">
						Código enviado a <span className="font-bold text-[#292524]">{email}</span>
					</p>
				</div>

				<form onSubmit={handleResetSubmit} className="space-y-3">
					<div className="space-y-1">
						<label className="text-xs font-bold text-stone-600">Código de 6 dígitos</label>
						<Input
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							required
							maxLength={6}
							value={otp}
							onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
							placeholder="000000"
							className="text-center text-lg font-black tracking-[0.35em] bg-[#fdf8ee] border-stone-300 text-[#292524] h-11"
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
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="Mínimo 6 caracteres"
								className="pl-9 bg-[#fdf8ee] border-stone-300 text-[#292524]"
							/>
						</div>
					</div>

					{info && (
						<p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
							{info}
						</p>
					)}

					{error && (
						<p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={loading || otp.length < 6 || newPassword.length < 6}
						className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer"
					>
						{loading ? 'Guardando...' : 'Cambiar contraseña y entrar'}
					</button>

					<div className="flex items-center justify-between pt-1 text-xs">
						<button
							type="button"
							onClick={() => {
								setStep('forgot');
								setOtp('');
								setError(null);
								setInfo(null);
							}}
							className="font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
						>
							← Cambiar correo
						</button>
						<button
							type="button"
							disabled={loading}
							onClick={handleForgotSubmit}
							className="font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer disabled:opacity-50"
						>
							Reenviar código
						</button>
					</div>
				</form>
			</div>
		);
	}

	return (
		<div className="p-4 sm:p-5 space-y-3.5 bg-[#fffdf9] text-[#292524]">
			<div className="text-center space-y-1">
				<div className="w-10 h-10 mx-auto rounded-2xl bg-emerald-500 border-2 border-b-4 border-emerald-700 text-white font-black text-lg flex items-center justify-center shadow-xs">
					F
				</div>
				<h2 className="text-base font-black tracking-tight pt-1">
					{isRegister ? 'Únete al Squad' : 'Bienvenido de vuelta'}
				</h2>
				<p className="text-xs text-stone-500">
					{isRegister
						? 'Crea tu cuenta para guardar tu racha y aparecer en el ranking.'
						: 'Inicia sesión con tu correo y contraseña.'}
				</p>
			</div>

			{/* Selector Entrar / Registrarse */}
			<div className="grid grid-cols-2 bg-[#f7eedb] border border-[#e6d8c3] p-1 rounded-xl text-xs font-bold">
				<button
					type="button"
					onClick={() => {
						setIsRegister(false);
						setError(null);
						setInfo(null);
					}}
					className={`py-1.5 rounded-lg transition-all cursor-pointer ${
						!isRegister
							? 'bg-emerald-500 text-white shadow-xs'
							: 'text-stone-600 hover:text-stone-900'
					}`}
				>
					Iniciar sesión
				</button>
				<button
					type="button"
					onClick={() => {
						setIsRegister(true);
						setError(null);
						setInfo(null);
					}}
					className={`py-1.5 rounded-lg transition-all cursor-pointer ${
						isRegister
							? 'bg-emerald-500 text-white shadow-xs'
							: 'text-stone-600 hover:text-stone-900'
					}`}
				>
					Crear cuenta
				</button>
			</div>

			<form onSubmit={handleSubmit} className="space-y-3">
				{isRegister && (
					<div className="space-y-1">
						<label className="text-xs font-bold text-stone-600">Apodo en el Ranking</label>
						<div className="relative">
							<User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
							<Input
								type="text"
								required
								maxLength={24}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Ej. Ardrubal Chiquito"
								className="pl-9 bg-[#fdf8ee] border-stone-300 text-[#292524]"
							/>
						</div>
					</div>
				)}

				<div className="space-y-1">
					<label className="text-xs font-bold text-stone-600">Correo electrónico</label>
					<div className="relative">
						<Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
						<Input
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="tu@correo.com"
							className="pl-9 bg-[#fdf8ee] border-stone-300 text-[#292524]"
						/>
					</div>
				</div>

				<div className="space-y-1">
					<div className="flex items-center justify-between">
						<label className="text-xs font-bold text-stone-600">Contraseña</label>
						{!isRegister && (
							<button
								type="button"
								onClick={() => {
									setStep('forgot');
									setError(null);
									setInfo(null);
								}}
								className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
							>
								¿Olvidaste tu contraseña?
							</button>
						)}
					</div>
					<div className="relative">
						<Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
						<Input
							type="password"
							required
							minLength={6}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Mínimo 6 caracteres"
							className="pl-9 bg-[#fdf8ee] border-stone-300 text-[#292524]"
						/>
					</div>
				</div>

				{info && (
					<p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
						{info}
					</p>
				)}

				{error && (
					<p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
						{error}
					</p>
				)}

				<button
					type="submit"
					disabled={loading}
					className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-b-4 border-emerald-700 text-white font-black text-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer mt-2"
				>
					{loading
						? 'Cargando...'
						: isRegister
							? 'Registrarme y verificar'
							: 'Entrar a jugar'}
				</button>
			</form>
		</div>
	);
}