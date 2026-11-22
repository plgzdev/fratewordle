import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import nodemailer from 'nodemailer';
import { db } from '@/db';
import * as schema from '@/db/schema';

async function sendSquadOtpEmail(
	email: string,
	otp: string,
	title: string,
	subtitle: string,
	subject: string
) {
	const gmailUser = process.env.GMAIL_USER;
	const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

	if (!gmailUser || !gmailAppPassword) {
		console.log(`[DEV OTP] ${subject} para ${email}: ${otp}`);
		return;
	}

	const transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		auth: {
			user: gmailUser,
			pass: gmailAppPassword
		}
	});

	try {
		await transporter.sendMail({
			from: `"FrateWordleSquad" <${gmailUser}>`,
			to: email,
			subject,
			html: `
				<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#fdf8ee;border:2px solid #e6d8c3;border-radius:16px;color:#292524;">
					<h2 style="margin:0 0 8px;font-size:20px;">${title}</h2>
					<p style="margin:0 0 16px;font-size:14px;color:#57534e;">${subtitle}</p>
					<div style="background:#10b981;color:#fff;font-size:28px;font-weight:900;letter-spacing:6px;text-align:center;padding:14px;border-radius:12px;">
						${otp}
					</div>
					<p style="margin:16px 0 0;font-size:12px;color:#78716c;">Este código expira en 5 minutos. Si no solicitaste esto, ignora este mensaje.</p>
				</div>
			`
		});
	} catch (err) {
		console.error('Error enviando correo con Gmail:', err);
		throw new Error('No se pudo enviar el correo');
	}
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	user: {
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async ({
				newEmail,
				url
			}: {
				newEmail: string;
				url: string;
			}) => {
				const gmailUser = process.env.GMAIL_USER;
				const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

				if (!gmailUser || !gmailAppPassword) {
					console.log(`[DEV CHANGE EMAIL] Enlace para ${newEmail}: ${url}`);
					return;
				}

				const transporter = nodemailer.createTransport({
					host: 'smtp.gmail.com',
					port: 465,
					secure: true,
					auth: {
						user: gmailUser,
						pass: gmailAppPassword
					}
				});

				await transporter.sendMail({
					from: `"FrateWordleSquad" <${gmailUser}>`,
					to: newEmail,
					subject: 'Confirma tu nuevo correo - FrateWordleSquad',
					html: `
						<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#fdf8ee;border:2px solid #e6d8c3;border-radius:16px;color:#292524;">
							<h2 style="margin:0 0 8px;font-size:20px;">Confirmar cambio de correo</h2>
							<p style="margin:0 0 16px;font-size:14px;color:#57534e;">Haz clic en el siguiente botón para confirmar que <strong>${newEmail}</strong> es tu nuevo correo en FrateWordleSquad:</p>
							<a href="${url}" style="display:block;background:#10b981;color:#fff;font-size:15px;font-weight:900;text-align:center;text-decoration:none;padding:14px;border-radius:12px;">
								Confirmar nuevo correo
							</a>
							<p style="margin:16px 0 0;font-size:12px;color:#78716c;">Si no solicitaste este cambio, ignora este mensaje.</p>
						</div>
					`
				});
			}
		}
	},
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
				if (type !== 'email-verification' && type !== 'forget-password') return;

				const isReset = type === 'forget-password';
				await sendSquadOtpEmail(
					email,
					otp,
					isReset ? 'Recuperar contraseña' : '¡Bienvenido a FrateWordleSquad!',
					isReset
						? 'Usa este código de un solo uso para restablecer tu contraseña:'
						: 'Usa este código de un solo uso para verificar tu cuenta:',
					isReset
						? `${otp} es tu código para recuperar contraseña - FrateWordleSquad`
						: `${otp} es tu código de verificación - FrateWordleSquad`
				);
			}
		})
	]
});