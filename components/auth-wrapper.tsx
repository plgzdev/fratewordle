'use client';

import { useRouter } from 'next/navigation';
import { AuthScreen } from './auth-screen';

export function AuthClientWrapper() {
	const router = useRouter();
	return <AuthScreen onSuccess={() => router.refresh()} />;
}