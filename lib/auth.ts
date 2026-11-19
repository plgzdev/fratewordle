import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { db } from '@/db';
import * as schema from '@/db/schema';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 6,
		requireEmailVerification: true
	},
	plugins: [
		emailOTP({
			overrideDefaultEmailVerification: true,
			sendVerificationOnSignUp: true,
			async sendVerificationOTP({ email, otp, type }) {
				if (type !== 'email-verification') return;

				const apiKey = process.env.RESEND_API_KEY;
				const from = process.env.EMAIL_FROM || 'FrateWordleSquad <onboarding@resend.dev>';

				if (!apiKey) {
					console.log(`[DEV OTP] Código de verificación para ${email}: ${otp}`);
					return;
				}

				const res = await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						from,
						to: email,
						subject: `${otp} es tu código de verificación - FrateWordleSquad`,
						html: `
							<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#fdf8ee;border:2px solid #e6d8c3;border-radius:16px;color:#292524;">
								<h2 style="margin:0 0 8px;font-size:20px;">¡Bienvenido a FrateWordleSquad!</h2>
								<p style="margin:0 0 16px;font-size:14px;color:#57534e;">Usa este código de un solo uso para verificar tu cuenta:</p>
								<div style="background:#10b981;color:#fff;font-size:28px;font-weight:900;letter-spacing:6px;text-align:center;padding:14px;border-radius:12px;">
									${otp}
								</div>
								<p style="margin:16px 0 0;font-size:12px;color:#78716c;">Este código expira en 5 minutos. Si no creaste esta cuenta, ignora este mensaje.</p>
							</div>
						`
					})
				});

				if (!res.ok) {
					const errText = await res.text();
					console.error('Error enviando OTP con Resend:', errText);
					throw new Error('No se pudo enviar el código de verificación');
				}
			}
		})
	]
});