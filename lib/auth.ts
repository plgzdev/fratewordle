import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { Resend } from 'resend';
import { db } from '@/db';
import * as schema from '@/db/schema';

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	plugins: [
		emailOTP({
			async sendVerificationOTP({ email, otp }) {
				await resend.emails.send({
					from: 'FrateWordleSquad <onboarding@resend.dev>',
					to: email,
					subject: `${otp} es tu código para FrateWordleSquad`,
					html: `
						<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
							<h2 style="margin-bottom: 8px;">FrateWordleSquad</h2>
							<p style="color: #52525b;">Ingresa este código de 6 dígitos para entrar y guardar tu puntaje en el ranking:</p>
							<div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px; background: #18181b; color: #ffffff; text-align: center; border-radius: 8px; margin: 20px 0;">
								${otp}
							</div>
							<p style="font-size: 12px; color: #71717a;">Este código expira en 5 minutos.</p>
						</div>
					`
				});
			}
		}),
		nextCookies()
	]
});