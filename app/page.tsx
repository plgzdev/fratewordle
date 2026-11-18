import { getInitialGameData } from '@/app/actions/game';
import { AuthClientWrapper } from '@/components/auth-wrapper';
import { GameShell } from '@/components/game-shell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
	const data = await getInitialGameData();

	if (!data) {
		return <AuthClientWrapper />;
	}

	return <GameShell initialData={data} />;
}