import { Suspense } from 'react';
import { getInitialGameData } from '@/app/actions/game';
import { GameShell } from '@/components/game-shell';

async function GameContent() {
	const data = await getInitialGameData();
	return <GameShell initialData={data} />;
}

export default function HomePage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-dvh bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
					Cargando FrateWordleSquad...
				</div>
			}
		>
			<GameContent />
		</Suspense>
	);
}