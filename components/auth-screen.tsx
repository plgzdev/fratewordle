'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, KeyRound } from 'lucide-react';

export function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
	const [step, setStep] = useState<'email' | 'otp'>('email');
	const [email, setEmail] = useState('');
	const [otp, setOtp] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	async function handleSendOtp(e: React.FormEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);

		const { error: err } = await authClient.emailOtp.sendVerificationOtp({
			email: email.trim().toLowerCase(),
			type: 'sign-in'
		});

		setLoading(false);
		if (err) {
			setError(err.message ?? 'No se pudo enviar el código');
			return;
		}
		setStep('otp');
	}

	async function handleVerifyOtp(e: React.FormEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);

		const { error: err } = await authClient.signIn.emailOtp({
			email: email.trim().toLowerCase(),
			otp: otp.trim()
		});

		setLoading(false);
		if (err) {
			setError('Código incorrecto o expirado');
			return;
		}
		onSuccess();
	}

	return (
		<div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4">
			<div className="w-full max-w-sm space-y-6 bg-zinc-900/70 border border-zinc-800 p-6 rounded-2xl">
				<div className="space-y-1.5 text-center">
					<h1 className="text-2xl font-extrabold tracking-tight">Frate Wordle Squad</h1>
					<p className="text-sm text-zinc-400">
						{step === 'email'
							? 'Ingresa tu correo para recibir tu código de acceso'
							: `Enviamos un código de 6 dígitos a ${email}`}
					</p>
				</div>

				{step === 'email' ? (
					<form onSubmit={handleSendOtp} className="space-y-4">
						<div className="relative">
							<Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
							<Input
								type="email"
								required
								placeholder="tu@correo.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="pl-9 bg-zinc-950 border-zinc-800 text-zinc-100"
							/>
						</div>
						{error && <p className="text-xs text-rose-400">{error}</p>}
						<Button type="submit" disabled={loading} className="w-full font-semibold">
							{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar código'}
						</Button>
					</form>
				) : (
					<form onSubmit={handleVerifyOtp} className="space-y-4">
						<div className="relative">
							<KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
							<Input
								type="text"
								inputMode="numeric"
								maxLength={6}
								required
								placeholder="000000"
								value={otp}
								onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
								className="pl-9 tracking-[0.4em] font-mono text-center text-lg bg-zinc-950 border-zinc-800 text-zinc-100"
							/>
						</div>
						{error && <p className="text-xs text-rose-400">{error}</p>}
						<Button type="submit" disabled={loading || otp.length < 6} className="w-full font-semibold">
							{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar a jugar'}
						</Button>
						<button
							type="button"
							onClick={() => {
								setStep('email');
								setOtp('');
								setError('');
							}}
							className="w-full text-xs text-zinc-400 hover:text-zinc-200"
						>
							Cambiar correo
						</button>
					</form>
				)}
			</div>
		</div>
	);
}