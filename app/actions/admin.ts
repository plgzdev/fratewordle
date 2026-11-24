'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { dailyWords, gameAttempts } from '@/db/schema';
import { and, asc, eq, gte } from 'drizzle-orm';
import { getLocalTodayStr, normalizeSpanish } from '@/lib/dictionary';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
	const session = await auth.api.getSession({ headers: await headers() });
	const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

	if (!session || !adminEmail || session.user.email.toLowerCase() !== adminEmail) {
		return null;
	}
	return session.user;
}

export async function getAdminSchedule() {
	const admin = await requireAdmin();
	if (!admin) return null;

	const today = getLocalTodayStr();
	const items = await db
		.select()
		.from(dailyWords)
		.where(gte(dailyWords.dateStr, today))
		.orderBy(asc(dailyWords.dateStr), asc(dailyWords.mode));

	return {
		today,
		items
	};
}

export async function saveSingleChallenge(input: {
	dateStr: string;
	mode: 'word' | 'phrase';
	word: string;
	hint?: string;
}) {
	const admin = await requireAdmin();
	if (!admin) return { error: 'UNAUTHORIZED' as const };

	const cleanedWord = normalizeSpanish(input.word).replace(/\s+/g, ' ').trim();
	if (cleanedWord.length < 2) return { error: 'INVALID_WORD' as const };
	if (input.mode === 'word' && /\s/.test(cleanedWord)) {
		return { error: 'WORD_NO_SPACES' as const };
	}

	const hint = input.hint?.trim() || null;

	const [existing] = await db
		.select()
		.from(dailyWords)
		.where(and(eq(dailyWords.dateStr, input.dateStr), eq(dailyWords.mode, input.mode)));

	if (existing) {
		await db
			.update(dailyWords)
			.set({ word: cleanedWord, hint })
			.where(eq(dailyWords.id, existing.id));
	} else {
		await db.insert(dailyWords).values({
			dateStr: input.dateStr,
			mode: input.mode,
			word: cleanedWord,
			hint
		});
	}

	revalidatePath('/');
	return { ok: true as const };
}

export async function updateChallenge(input: {
	id: number;
	word: string;
	hint?: string;
}) {
	const admin = await requireAdmin();
	if (!admin) return { error: 'UNAUTHORIZED' as const };

	const [existing] = await db
		.select()
		.from(dailyWords)
		.where(eq(dailyWords.id, input.id));

	if (!existing) return { error: 'NOT_FOUND' as const };

	const cleanedWord = normalizeSpanish(input.word).replace(/\s+/g, ' ').trim();
	if (cleanedWord.length < 2) return { error: 'INVALID_WORD' as const };
	if (existing.mode === 'word' && /\s/.test(cleanedWord)) {
		return { error: 'WORD_NO_SPACES' as const };
	}

	const hint = input.hint?.trim() || null;

	await Promise.all([
		db
			.update(dailyWords)
			.set({ word: cleanedWord, hint })
			.where(eq(dailyWords.id, input.id)),
		db.delete(gameAttempts).where(eq(gameAttempts.wordId, input.id))
	]);

	revalidatePath('/');
	return { ok: true as const };
}

function addDaysToDateStr(dateStr: string, days: number): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return dt.toISOString().slice(0, 10);
}

export async function saveBulkSchedule(input: {
	startDate: string;
	mode: 'word' | 'phrase';
	rawLines: string;
}) {
	const admin = await requireAdmin();
	if (!admin) return { error: 'UNAUTHORIZED' as const };

	const lines = input.rawLines
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);

	if (lines.length === 0) return { error: 'EMPTY_LIST' as const };

	let count = 0;

	for (let i = 0; i < lines.length; i++) {
		// Formato aceptado por línea: PALABRA O FRASE | pista opcional
		const [wordPart, hintPart] = lines[i].split('|');
		const cleanedWord = normalizeSpanish(wordPart ?? '').replace(/\s+/g, ' ').trim();
		if (cleanedWord.length < 2) continue;
		if (input.mode === 'word' && /\s/.test(cleanedWord)) continue;

		const targetDate = addDaysToDateStr(input.startDate, count);
		const hint = hintPart?.trim() || null;

		const [existing] = await db
			.select()
			.from(dailyWords)
			.where(and(eq(dailyWords.dateStr, targetDate), eq(dailyWords.mode, input.mode)));

		if (existing) {
			await db
				.update(dailyWords)
				.set({ word: cleanedWord, hint })
				.where(eq(dailyWords.id, existing.id));
		} else {
			await db.insert(dailyWords).values({
				dateStr: targetDate,
				mode: input.mode,
				word: cleanedWord,
				hint
			});
		}

		count++;
	}

	revalidatePath('/');
	return { ok: true as const, count };
}

export async function deleteChallenge(id: number) {
	const admin = await requireAdmin();
	if (!admin) return { error: 'UNAUTHORIZED' as const };

	await db.delete(dailyWords).where(eq(dailyWords.id, id));
	revalidatePath('/');
	return { ok: true as const };
}