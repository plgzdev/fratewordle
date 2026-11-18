import { pgTable, text, integer, timestamp, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	currentStreak: integer('current_streak').default(0).notNull(),
	maxStreak: integer('max_streak').default(0).notNull()
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const dailyWords = pgTable('daily_words', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	dateStr: text('date_str').notNull(),
	mode: text('mode').$type<'word' | 'phrase'>().default('word').notNull(),
	word: text('word').notNull(),
	hint: text('hint')
}, (table) => [
	uniqueIndex('daily_words_date_mode_unique').on(table.dateStr, table.mode)
]);

export const gameAttempts = pgTable('game_attempts', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	wordId: integer('word_id').notNull().references(() => dailyWords.id, { onDelete: 'cascade' }),
	guesses: jsonb('guesses').$type<string[]>().default([]).notNull(),
	status: text('status').$type<'playing' | 'won' | 'lost'>().default('playing').notNull(),
	score: integer('score').default(0).notNull(),
	startedAt: timestamp('started_at').defaultNow().notNull(),
	finishedAt: timestamp('finished_at')
}, (table) => [
	uniqueIndex('user_word_unique').on(table.userId, table.wordId)
]);