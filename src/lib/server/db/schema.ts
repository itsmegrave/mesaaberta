import { sql } from 'drizzle-orm';
import {
	check,
	foreignKey,
	jsonb,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// `member | admin`: GM is not a role. Anyone signed in can open a table and becomes its GM.
export const profileRole = pgEnum('profile_role', ['member', 'admin']);
export const profileStatus = pgEnum('profile_status', ['active', 'suspended']);
export const joinMode = pgEnum('join_mode', ['auto', 'approval']);
export const tableKind = pgEnum('table_kind', ['campaign', 'one_shot']);
export const tableStatus = pgEnum('table_status', ['active', 'disabled']);
// A pending request takes no seat; only a confirmed one does.
export const registrationStatus = pgEnum('registration_status', ['pending', 'confirmed']);

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};

// Every table turns row level security on, with no policy. Supabase serves the `public` schema over
// its REST API to anyone with the (public) publishable key; RLS with no policy leaves that API with
// nothing to read or write. The app is not affected: it connects as the database owner, which RLS
// does not apply to. Add a policy here only for a table that should be reachable through that API.

export const profiles = pgTable('profiles', {
	// The Supabase auth user id. Not a foreign key: Supabase owns the `auth` schema.
	id: uuid('id').primaryKey(),
	displayName: text('display_name').notNull(),
	avatarUrl: text('avatar_url'),
	role: profileRole('role').notNull().default('member'),
	status: profileStatus('status').notNull().default('active'),
	...timestamps
}).enableRLS();

// The RPG systems (D&D 5e, Tormenta 20, ...). They double as the categories tables are browsed by,
// so each has a slug for its URL. The rows come from a migration; add one with a new migration.
export const systems = pgTable(
	'systems',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Shown exactly as written.
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		// Position in the source list: the most played systems first, then A to Z. Pickers sort by it.
		position: integer('position').notNull()
	},
	(system) => [
		uniqueIndex('systems_slug_unique').on(system.slug),
		uniqueIndex('systems_name_unique').on(system.name)
	]
).enableRLS();

export const gameTables = pgTable(
	'game_tables',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Generated from the title; it is the table's public URL (`/tables/<slug>`).
		slug: text('slug').notNull(),
		joinMode: joinMode('join_mode').notNull().default('auto'),
		systemId: uuid('system_id')
			.notNull()
			.references(() => systems.id),
		title: text('title').notNull(),
		imagePath: text('image_path'),
		description: text('description').notNull().default(''),
		extraInfo: text('extra_info'),
		kind: tableKind('kind').notNull(),
		capacity: integer('capacity').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		durationMinutes: integer('duration_minutes').notNull(),
		timezone: text('timezone').notNull(),
		// An iCalendar RRULE for a campaign; null for a one-shot.
		recurrence: text('recurrence'),
		until: timestamp('until', { withTimezone: true }),
		status: tableStatus('status').notNull().default('active'),
		// Incremented on every edit so calendar clients replace the invite instead of adding one.
		icalSequence: integer('ical_sequence').notNull().default(0),
		gmId: uuid('gm_id')
			.notNull()
			.references(() => profiles.id),
		...timestamps
	},
	(table) => [
		uniqueIndex('game_tables_slug_unique').on(table.slug),
		index('game_tables_gm_id_idx').on(table.gmId),
		index('game_tables_system_id_idx').on(table.systemId),
		check(
			'game_tables_recurrence_matches_kind',
			sql`(${table.kind} = 'one_shot' AND ${table.recurrence} IS NULL) OR (${table.kind} = 'campaign' AND ${table.recurrence} IS NOT NULL)`
		),
		check('game_tables_capacity_positive', sql`${table.capacity} > 0`),
		check('game_tables_duration_positive', sql`${table.durationMinutes} > 0`)
	]
).enableRLS();

// The transactional outbox and the audit log in one table. A row is written in the same transaction
// as the change it describes, then dispatched to handlers after the commit; a sweeper retries what
// did not finish. Rows are never deleted: they are the record of who did what, and when.
export const events = pgTable(
	'events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		type: text('type').notNull(),
		// Who did it. Not a foreign key, so the record outlives the account (account deletion, #21).
		actorId: uuid('actor_id'),
		// Ids and public facts only. Never an email address or a token.
		payload: jsonb('payload').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		processedAt: timestamp('processed_at', { withTimezone: true }),
		attempts: integer('attempts').notNull().default(0),
		// Not before this time: the backoff after a failed attempt.
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
		lastError: text('last_error'),
		// The handlers that already succeeded, so a retry runs only the ones that did not.
		handledBy: text('handled_by')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		// Set when the attempt cap is reached: the event stays for a person to look at, no retries.
		failedAt: timestamp('failed_at', { withTimezone: true }),
		// A lease, so two dispatchers never run the same event at once.
		claimedUntil: timestamp('claimed_until', { withTimezone: true })
	},
	(event) => [
		// What the sweeper looks for: events not yet done and not given up on.
		index('events_pending_idx')
			.on(event.nextAttemptAt)
			.where(sql`${event.processedAt} IS NULL AND ${event.failedAt} IS NULL`),
		index('events_actor_idx').on(event.actorId, event.createdAt)
	]
).enableRLS();

// A player's place at a table. Only `confirmed` rows take a seat, get invites and can rate. A
// declined request, a player who leaves and a player who is removed are deleted: the record of it is
// the event, not a row here.
export const registrations = pgTable(
	'registrations',
	{
		tableId: uuid('table_id')
			.notNull()
			.references(() => gameTables.id),
		playerId: uuid('player_id')
			.notNull()
			.references(() => profiles.id),
		status: registrationStatus('status').notNull().default('pending'),
		...timestamps
	},
	(registration) => [
		primaryKey({ columns: [registration.tableId, registration.playerId] }),
		index('registrations_player_idx').on(registration.playerId)
	]
).enableRLS();

// What a player thought of a table and of its GM, once they had played. One per registration, and it
// goes with it: a player who is removed takes their rating with them (cascade). A GM's average is
// computed by a query, never stored.
export const ratings = pgTable(
	'ratings',
	{
		tableId: uuid('table_id').notNull(),
		playerId: uuid('player_id').notNull(),
		tableScore: smallint('table_score').notNull(),
		gmScore: smallint('gm_score').notNull(),
		comment: text('comment'),
		...timestamps
	},
	(rating) => [
		primaryKey({ columns: [rating.tableId, rating.playerId] }),
		foreignKey({
			name: 'ratings_registration_fk',
			columns: [rating.tableId, rating.playerId],
			foreignColumns: [registrations.tableId, registrations.playerId]
		}).onDelete('cascade'),
		check('ratings_table_score_range', sql`${rating.tableScore} BETWEEN 1 AND 5`),
		check('ratings_gm_score_range', sql`${rating.gmScore} BETWEEN 1 AND 5`),
		check('ratings_comment_length', sql`char_length(${rating.comment}) <= 1000`),
		index('ratings_table_idx').on(rating.tableId)
	]
).enableRLS();
