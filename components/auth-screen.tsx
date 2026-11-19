'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/ui/input';
import { Lock, Mail, User } from 'lucide-react';

interface AuthScreenProps {
	onSuccess: () => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
	const [isRegister, setIsRegister] = useState(false);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			if (isRegister) {
				const cleanName = name.trim() || email.split('@')[0];
				const res = await authClient.signUp.email({
					email: email.trim(),
					password,
					name: cleanName
				});

				if (res.error) {
					setError(res.error.message || 'No se pudo crear la cuenta.');
					setLoading(false);
					return;
				}
			} else {
				const res = await authClient.signIn.email({
					email: email.trim(),
					password
				});

				if (res.error) {
					setError('Correo o contraseña incorrectos.');
					setLoading(false);
					return;
				}
			}

			setLoading(false);
			onSuccess();
		} catch {
			setError('Ocurrió un error al conectar. Intenta de nuevo.');
			setLoading(false);
		}
	}

	return (
		<div className="p-6 space-y-5 bg-[#fffdf9] text-[#292524]">
			<div className="text-center space-y-1">
				<div className="w-11 h-11 mx-auto rounded-2xl bg-emerald-500 border-2 border-b-4 border-emerald-700 text-white font-black text-xl flex items-center justify-center shadow-xs">
					F
				</div>
				<h2 className="text-lg font-black tracking-tight pt-1">
					{isRegister ? 'Únete a la Frate' : 'Bienvenido de vuelta'}
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
								placeholder="Ej. Asdrubal Chiquito"
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
					<label className="text-xs font-bold text-stone-600">Contraseña</label>
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
							? 'Registrarme y entrar'
							: 'Entrar a jugar'}
				</button>
			</form>
		</div>
	);
}