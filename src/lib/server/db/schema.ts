import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	pgEnum,
	pgTable,
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

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};

export const profiles = pgTable('profiles', {
	// The Supabase auth user id. Not a foreign key: Supabase owns the `auth` schema.
	id: uuid('id').primaryKey(),
	displayName: text('display_name').notNull(),
	avatarUrl: text('avatar_url'),
	role: profileRole('role').notNull().default('member'),
	status: profileStatus('status').notNull().default('active'),
	...timestamps
});

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
);

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
);
