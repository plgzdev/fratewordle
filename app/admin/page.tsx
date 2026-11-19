import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAdminSchedule } from '@/app/actions/admin';
import { AdminPanel } from '@/components/admin-panel';

async function AdminContent() {
	const schedule = await getAdminSchedule();
	if (!schedule) {
		redirect('/');
	}
	return <AdminPanel initialSchedule={schedule} />;
}

export default function AdminPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-dvh bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
					Verificando acceso...
				</div>
			}
		>
			<AdminContent />
		</Suspense>
	);
}