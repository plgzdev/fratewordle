import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin']
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin']
});

export const metadata: Metadata = {
	title: 'FrateWordleSquad · Palabra y Frase Diaria',
	description: 'Adivina la palabra y la frase del día, compite con el Squad y mantén tu racha.'
};

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="es">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#fdf8ee] text-[#292524] selection:bg-amber-300/50 selection:text-amber-950`}
			>
				{children}
			</body>
		</html>
	);
}