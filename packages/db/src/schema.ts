import { TABLE_STATUSES } from './table-status';
import { PROFILE_STATUSES } from './profile-status';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
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
  uuid,
} from 'drizzle-orm/pg-core';

// `member | admin`: GM is not a role. Anyone signed in can open a table and becomes its GM.
export const profileRole = pgEnum('profile_role', ['member', 'admin']);
export const profileStatus = pgEnum('profile_status', PROFILE_STATUSES);
// A person's gender, when they say. `other` goes with their own words in `gender_other`. Keep in
// step with GENDER_OPTIONS (src/lib/profile/schema.ts); a test checks the two lists match.
export const genderIdentity = pgEnum('gender_identity', [
  'woman',
  'man',
  'trans_woman',
  'trans_man',
  'non_binary',
  'agender',
  'genderfluid',
  'travesti',
  'other',
]);

export const ageRange = pgEnum('age_range', [
  '13_17',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_plus',
]);
export const joinMode = pgEnum('join_mode', ['auto', 'approval']);
export const tableKind = pgEnum('table_kind', ['campaign', 'one_shot', 'adventure']);
// `active` is open; `disabled` is the GM cancelling before the session; after the session the GM
// confirms it: `awaiting_confirmation` until they answer, then `concluded` or `not_held`.
export const tableStatus = pgEnum('table_status', TABLE_STATUSES);
// Where the table plays: over the internet, or around a real table.
export const tableModality = pgEnum('table_modality', ['online', 'in_person']);
// Where a platform or a tag stands in the catalog. Only approved ones are public; the rest are for
// the GM who suggested them and the admins (the suggestion flow is card #34).
export const catalogStatus = pgEnum('catalog_status', [
  'pending',
  'approved',
  'rejected',
  'disabled',
]);
// A pending request takes no seat; only a confirmed one does.
export const registrationStatus = pgEnum('registration_status', ['pending', 'confirmed']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Every table turns row level security on, with no policy. Supabase serves the `public` schema over
// its REST API to anyone with the (public) publishable key; RLS with no policy leaves that API with
// nothing to read or write. The app is not affected: it connects as the database owner, which RLS
// does not apply to. Add a policy here only for a table that should be reachable through that API.

export const profiles = pgTable(
  'profiles',
  {
    // The Supabase auth user id. Not a foreign key: Supabase owns the `auth` schema.
    id: uuid('id').primaryKey(),
    // The public identifier and slug. Null only until the onboarding step is done: the base profile is
    // created at sign-up, before the person has picked one. Stored lowercase (see the check below).
    username: text('username'),
    // The details below are all optional. `name` is pre-filled from the sign-in provider.
    name: text('name'),
    ageRange: ageRange('age_range'),
    gender: genderIdentity('gender'),
    // Only with `other`: how the person describes themselves, in their own words.
    genderOther: text('gender_other'),
    city: text('city'),
    // The picture from the sign-in provider (Google, Discord).
    avatarUrl: text('avatar_url'),
    // A picture the person uploaded, in the profile-avatars bucket; it wins over the provider's.
    avatarPath: text('avatar_path'),
    // The IANA zone times are shown in (`America/Sao_Paulo`). Null until the person picks one: the
    // browser's zone is used meanwhile (see `viewerTimezone`).
    timezone: text('timezone'),
    // Off: nobody can start a direct message with this person, and existing ones stop taking new
    // messages. Table chats are not affected.
    directMessagesEnabled: boolean('direct_messages_enabled').notNull().default(true),
    role: profileRole('role').notNull().default('member'),
    status: profileStatus('status').notNull().default('active'),
    // A ban by the moderation: `status` is `suspended` while it lasts. `bannedUntil` null with a
    // `bannedAt` is permanent; a temporary one is lifted once that time passes (see liftExpiredBans).
    // The reason is what the person is told by e-mail. A closed account is suspended with none of these.
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    bannedUntil: timestamp('banned_until', { withTimezone: true }),
    banReason: text('ban_reason'),
    ...timestamps,
  },
  (profile) => [
    // Unique on the lowercase form, so `Ana` and `ana` cannot both exist even if a caller forgets to
    // normalise. Nulls do not collide: many profiles can be waiting for onboarding.
    uniqueIndex('profiles_username_unique').on(sql`lower(${profile.username})`),
    check('profiles_username_format', sql`${profile.username} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    // Mirrors RESOLUTION_NOTE_MAX in $lib/moderation/reports.
    check('profiles_ban_reason_length', sql`char_length(${profile.banReason}) <= 1000`),
    // Expired temporary bans, for the sweep that lifts them.
    index('profiles_banned_until_idx')
      .on(profile.bannedUntil)
      .where(sql`${profile.bannedUntil} IS NOT NULL`),
  ],
).enableRLS();

// The social links on a profile: any number, in the order the person put them.
export const profileSocialLinks = pgTable(
  'profile_social_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    // One of the networks in `$lib/profile/social-links`, or `website`.
    network: text('network').notNull(),
    // What the person typed for a network (`mesaaberta`, no `@`). Null for `website`, and for links
    // saved before handles, which only have an address.
    handle: text('handle'),
    // Where it opens. Null for a handle with no address (Discord).
    url: text('url'),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (link) => [
    index('profile_social_links_profile_idx').on(link.profileId, link.position),
    check(
      'profile_social_links_target_check',
      sql`${link.handle} IS NOT NULL OR ${link.url} IS NOT NULL`,
    ),
  ],
).enableRLS();

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
    position: integer('position').notNull(),
  },
  (system) => [
    uniqueIndex('systems_slug_unique').on(system.slug),
    uniqueIndex('systems_name_unique').on(system.name),
  ],
).enableRLS();

// CEPs already looked up (ViaCEP), so the same one is never asked for twice. Public facts, no
// personal data: a CEP is an area, not an address.
export const postalCodes = pgTable(
  'postal_codes',
  {
    cep: text('cep').primaryKey(),
    neighbourhood: text('neighbourhood'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    ...timestamps,
  },
  (row) => [check('postal_codes_cep_format', sql`${row.cep} ~ '^[0-9]{8}$'`)],
).enableRLS();

/** The columns platforms and tags share: a catalog kept by admins, where GMs can suggest entries. */
const catalogColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Lowercase, unique: two suggestions that differ only in case are the same entry.
  slug: text('slug').notNull(),
  status: catalogStatus('status').notNull().default('approved'),
  // Catalog order: pickers and filters list them by it.
  position: integer('position').notNull().default(1000),
  suggestedBy: uuid('suggested_by').references(() => profiles.id, { onDelete: 'set null' }),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  // A duplicate merged into another entry points at it.
  mergedInto: uuid('merged_into'),
  ...timestamps,
});

// Where a table plays online: Discord, Foundry VTT, Roll20, ...
export const platforms = pgTable('platforms', catalogColumns(), (row) => [
  uniqueIndex('platforms_slug_unique').on(sql`lower(${row.slug})`),
  check('platforms_slug_format', sql`${row.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
]).enableRLS();

// What a table is like: Iniciantes, Terror, Roleplay, ...
export const tags = pgTable('tags', catalogColumns(), (row) => [
  uniqueIndex('tags_slug_unique').on(sql`lower(${row.slug})`),
  check('tags_slug_format', sql`${row.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
]).enableRLS();

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
    // The GM's message to each player who gets a seat. Private: only ever sent by e-mail, never selected by the public queries.
    welcomeMessage: text('welcome_message'),
    kind: tableKind('kind').notNull(),
    // Existing tables were all online, so that is the default.
    modality: tableModality('modality').notNull().default('online'),
    // Public, for an in-person table: the neighbourhood and city ("Boa Viagem, Recife"), never the
    // address.
    locationArea: text('location_area'),
    // Private: how to join (the Discord or VTT link, or the address). Shown only to the GM and the
    // confirmed players, never selected by the public queries.
    joinDetails: text('join_details'),
    // Optional CEP of an in-person table (8 digits), and what it resolved to, for filters by state,
    // city and neighbourhood. The street is never stored.
    postalCode: text('postal_code'),
    locationNeighbourhood: text('location_neighbourhood'),
    locationCity: text('location_city'),
    locationState: text('location_state'),
    capacity: integer('capacity').notNull(),
    // The fewest confirmed players the GM wants before the table goes ahead. Optional: null says it
    // makes no difference. Never more than `capacity`.
    minPlayers: integer('min_players'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    timezone: text('timezone').notNull(),
    // An iCalendar RRULE for a campaign; null for a one-shot.
    recurrence: text('recurrence'),
    until: timestamp('until', { withTimezone: true }),
    status: tableStatus('status').notNull().default('active'),
    // Incremented on every edit so calendar clients replace the invite instead of adding one.
    icalSequence: integer('ical_sequence').notNull().default(0),
    // Set when an admin closed the table over a report (it is `disabled` too). The justification is
    // kept with the table (and for admins), not shown to the public.
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    moderationNote: text('moderation_note'),
    gmId: uuid('gm_id')
      .notNull()
      .references(() => profiles.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('game_tables_slug_unique').on(table.slug),
    index('game_tables_gm_id_idx').on(table.gmId),
    index('game_tables_system_id_idx').on(table.systemId),
    index('game_tables_location_idx').on(table.locationState, table.locationCity),
    check('game_tables_postal_code_format', sql`${table.postalCode} ~ '^[0-9]{8}$'`),
    check(
      'game_tables_recurrence_matches_kind',
      sql`(${table.kind}::text IN ('one_shot', 'adventure') AND ${table.recurrence} IS NULL) OR (${table.kind}::text = 'campaign' AND ${table.recurrence} IS NOT NULL)`,
    ),
    check('game_tables_capacity_positive', sql`${table.capacity} > 0`),
    check(
      'game_tables_min_players_range',
      sql`${table.minPlayers} IS NULL OR (${table.minPlayers} >= 1 AND ${table.minPlayers} <= ${table.capacity})`,
    ),
    check('game_tables_duration_positive', sql`${table.durationMinutes} > 0`),
    check(
      'game_tables_in_person_has_area',
      sql`${table.modality} = 'online' OR ${table.locationArea} IS NOT NULL`,
    ),
    // Mirror TABLE_LIMITS in $lib/tables/schema.
    check('game_tables_location_area_length', sql`char_length(${table.locationArea}) <= 120`),
    // Both are rich-text HTML: the visible limit (1000) times RICH_HTML_FACTOR in $lib/text/rich-schema.
    check('game_tables_join_details_length', sql`char_length(${table.joinDetails}) <= 6000`),
    check('game_tables_welcome_message_length', sql`char_length(${table.welcomeMessage}) <= 6000`),
    // Mirrors RESOLUTION_NOTE_MAX in $lib/moderation/reports.
    check('game_tables_moderation_note_length', sql`char_length(${table.moderationNote}) <= 1000`),
  ],
).enableRLS();

// The platforms and the tags of a table, in the order the GM picked them.
export const gameTablePlatforms = pgTable(
  'game_table_platforms',
  {
    tableId: uuid('table_id')
      .notNull()
      .references(() => gameTables.id, { onDelete: 'cascade' }),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id),
    position: integer('position').notNull(),
  },
  (row) => [
    primaryKey({ columns: [row.tableId, row.platformId] }),
    index('game_table_platforms_platform_idx').on(row.platformId),
  ],
).enableRLS();

export const gameTableTags = pgTable(
  'game_table_tags',
  {
    tableId: uuid('table_id')
      .notNull()
      .references(() => gameTables.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id),
    position: integer('position').notNull(),
  },
  (row) => [
    primaryKey({ columns: [row.tableId, row.tagId] }),
    index('game_table_tags_tag_idx').on(row.tagId),
  ],
).enableRLS();

// The transactional outbox and the audit log in one table. A row is written in the same transaction
// as the change it describes, then dispatched to handlers after the commit; a sweeper retries what
// did not finish. Rows are the record of who did what, and when; a finished one is deleted after
// RETENTION_DAYS (see pruneEvents).
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
    claimedUntil: timestamp('claimed_until', { withTimezone: true }),
  },
  (event) => [
    // What the sweeper looks for: events not yet done and not given up on.
    index('events_pending_idx')
      .on(event.nextAttemptAt)
      .where(sql`${event.processedAt} IS NULL AND ${event.failedAt} IS NULL`),
    index('events_actor_idx').on(event.actorId, event.createdAt),
    // A table's recent activity, on the GM's manage page.
    index('events_table_idx').on(sql`(${event.payload}->>'tableId')`, event.createdAt),
  ],
).enableRLS();

// One service account for Mesa Aberta, never a GM's personal Instagram. Tokens are AES-GCM
// encrypted with a Worker secret. Neither this table nor post assets are exposed through Supabase.
export const instagramAccounts = pgTable('instagram_accounts', {
  id: text('id').primaryKey().default('mesaaberta'),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}).enableRLS();

export const instagramPosts = pgTable(
  'instagram_posts',
  {
    tableId: uuid('table_id')
      .primaryKey()
      .references(() => gameTables.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').notNull(),
    status: text('status').notNull().default('queued'),
    caption: text('caption'),
    // Small temporary JPEGs; an unguessable capability URL expires and the cron clears the bytes.
    assetKey: uuid('asset_key').notNull().defaultRandom(),
    image: text('image'),
    assetExpiresAt: timestamp('asset_expires_at', { withTimezone: true }),
    accountId: text('account_id'),
    containerId: text('container_id'),
    mediaId: text('media_id'),
    permalink: text('permalink'),
    lastError: text('last_error'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    claimedUntil: timestamp('claimed_until', { withTimezone: true }),
    ...timestamps,
  },
  (post) => [
    uniqueIndex('instagram_posts_asset_idx').on(post.assetKey),
    check(
      'instagram_posts_status',
      sql`${post.status} IN ('queued', 'processing', 'publishing', 'published', 'failed', 'uncertain', 'skipped')`,
    ),
  ],
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
    // How the player introduced themselves to the GM when asking for the seat. Optional, plain text,
    // and only kept for a request that needs approval.
    message: text('message'),
    ...timestamps,
  },
  (registration) => [
    primaryKey({ columns: [registration.tableId, registration.playerId] }),
    index('registrations_player_idx').on(registration.playerId),
    // Mirror JOIN_MESSAGE_MAX in $lib/tables/registration.
    check('registrations_message_length', sql`char_length(${registration.message}) <= 500`),
  ],
).enableRLS();

// What a player thought of the GM of a table they played at: tables are not rated, GMs are. A
// rating is made once, after the GM confirmed the session happened, and is final: it is not edited,
// and it outlives the seat (a player who leaves or is removed keeps what they said about a session
// that took place). It goes only with its table, or with the GM's account (see `closeAccount`).
export const ratings = pgTable(
  'ratings',
  {
    tableId: uuid('table_id')
      .notNull()
      .references(() => gameTables.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => profiles.id),
    gmScore: smallint('gm_score').notNull(),
    comment: text('comment'),
    ...timestamps,
  },
  (rating) => [
    primaryKey({ columns: [rating.tableId, rating.playerId] }),
    check('ratings_gm_score_range', sql`${rating.gmScore} BETWEEN 1 AND 5`),
    check('ratings_comment_length', sql`char_length(${rating.comment}) <= 1000`),
    index('ratings_table_idx').on(rating.tableId),
  ],
).enableRLS();

// A GM's score, worked out from their ratings and kept until it can change: when the month turns
// (the weights age by months) or when a rating is added or removed (a trigger on `ratings` raises
// `version`, even for a GM with no row yet). Read it through `gmRatings`, never by hand.
export const gmScores = pgTable('gm_scores', {
  gmId: uuid('gm_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  score: doublePrecision('score'),
  count: integer('count').notNull().default(0),
  // The first day (UTC) of the month the score was worked out for.
  month: date('month', { mode: 'string' }).notNull(),
  version: bigint('version', { mode: 'number' }).notNull().default(0),
  computedVersion: bigint('computed_version', { mode: 'number' }).notNull().default(0),
}).enableRLS();

// Attempts at the sign-in, sign-up and password-reset forms, to limit them per network before
// anyone is signed in (see auth/attempt-limit.ts). `key` is a hash of the action and the IP, never
// the IP itself, and rows are deleted after a day.
export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (attempt) => [
    index('auth_attempts_key_created_idx').on(attempt.key, attempt.createdAt),
    index('auth_attempts_created_idx').on(attempt.createdAt),
  ],
).enableRLS();

// What an in-app notification is about; the feed filters on it. Only `table`, `registration` and
// `rating` have events today; the rest are for the catalog, moderation and announcement slices.
export const notificationCategory = pgEnum('notification_category', [
  'table',
  'registration',
  'rating',
  'catalog',
  'moderation',
  'system',
  'messages',
]);

// The bell in the header. A domain notification keeps its type and ids only, and is worded when it
// is shown, like the manage page's activity; `title` and `body` are for announcements written by a
// person. One per event and recipient, so a retried handler adds nothing. Read ones are deleted
// after NOTIFICATION_RETENTION_DAYS, and all of a person's go when their account is closed.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
    // The event it came from. Not a foreign key: events are pruned sooner than notifications.
    eventId: uuid('event_id'),
    category: notificationCategory('category').notNull(),
    type: text('type').notNull(),
    // Overrides the icon the type implies (announcements pick their own).
    icon: text('icon'),
    title: text('title'),
    body: text('body'),
    link: text('link'),
    // Ids and public facts the wording needs (table slug and title). Never an email address.
    metadata: jsonb('metadata').notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (notification) => [
    uniqueIndex('notifications_event_recipient_idx').on(
      notification.eventId,
      notification.recipientId,
    ),
    index('notifications_recipient_feed_idx').on(notification.recipientId, notification.createdAt),
    // The badge: a person's unread count.
    index('notifications_recipient_unread_idx')
      .on(notification.recipientId, notification.createdAt)
      .where(sql`${notification.readAt} IS NULL`),
    // One unread "new messages" notification per conversation: the next message updates it.
    uniqueIndex('notifications_unread_message_idx')
      .on(notification.recipientId, sql`(${notification.metadata}->>'conversationId')`)
      .where(sql`${notification.type} = 'message_received' AND ${notification.readAt} IS NULL`),
  ],
).enableRLS();

// A table's chat is a `table` conversation (one per table, its members are the GM and the confirmed
// players); anything else is a `direct` one between two people.
export const conversationKind = pgEnum('conversation_kind', ['table', 'direct']);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: conversationKind('kind').notNull(),
    // The table of a `table` conversation. Deleting a table's chat is the cron's job (see
    // pruneTableChats), so the foreign key restricts.
    tableId: uuid('table_id').references(() => gameTables.id),
    // `low:high` of the two profile ids of a `direct` conversation, so a pair has one thread.
    pairKey: text('pair_key'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (conversation) => [
    uniqueIndex('conversations_table_unique')
      .on(conversation.tableId)
      .where(sql`${conversation.kind} = 'table'`),
    uniqueIndex('conversations_pair_unique')
      .on(conversation.pairKey)
      .where(sql`${conversation.kind} = 'direct'`),
    index('conversations_last_message_idx').on(conversation.lastMessageAt),
    check(
      'conversations_kind_matches_columns',
      sql`(${conversation.kind} = 'table' AND ${conversation.tableId} IS NOT NULL AND ${conversation.pairKey} IS NULL) OR (${conversation.kind} = 'direct' AND ${conversation.pairKey} IS NOT NULL AND ${conversation.tableId} IS NULL)`,
    ),
  ],
).enableRLS();

// Who is in a conversation, and how far they have read. A table conversation's rows follow the
// registrations; a direct one has its two people for good.
export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    // Messages after this are unread. Null: nothing read yet.
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    // Muted: the conversation stays in the inbox but adds nothing to the bell.
    mutedAt: timestamp('muted_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (member) => [
    primaryKey({ columns: [member.conversationId, member.profileId] }),
    index('conversation_members_profile_idx').on(member.profileId),
  ],
).enableRLS();

// Plain text, at most MESSAGE_MAX_LENGTH characters. `senderId` is set null when the account is
// closed, so the others keep the thread but not the person's words (see closeAccount).
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => profiles.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    // What a direct message is about, when it started from a table ("Sobre a mesa X").
    tableId: uuid('table_id').references(() => gameTables.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (message) => [
    index('messages_conversation_created_idx').on(message.conversationId, message.createdAt.desc()),
    index('messages_sender_idx').on(message.senderId),
    // Mirrors MESSAGE_MAX_LENGTH in $lib/messages/schema.
    check('messages_body_length', sql`char_length(${message.body}) BETWEEN 1 AND 2000`),
  ],
).enableRLS();

// Mirror REPORT_TARGETS, REPORT_REASONS and REPORT_STATUSES in $lib/moderation/reports.
export const reportTarget = pgEnum('report_target', ['table', 'player', 'crowdfunding', 'partner']);
export const reportReason = pgEnum('report_reason', [
  'spam',
  'harassment',
  'inappropriate_content',
  'no_show',
  'other',
  'broken_link',
  'scam',
  'off_topic',
  'no_backlink',
]);
// `open` and `reviewing` wait on an admin; `resolved` and `dismissed` are closed.
export const reportStatus = pgEnum('report_status', ['open', 'reviewing', 'resolved', 'dismissed']);

// A member flagging a table, or a player they share a table with, for an admin to look at. The
// reported party is never told who reported them. `tableId` is where it happened: the table itself,
// or the table the two share. What the admin did is the event; the row keeps the outcome.
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => profiles.id),
    targetType: reportTarget('target_type').notNull(),
    // The table or the player's profile, by `targetType`. Not a foreign key: it points at either.
    targetId: uuid('target_id').notNull(),
    // Where it happened. Null for a report about a crowdfunding campaign or a partner, which belong to no table.
    tableId: uuid('table_id').references(() => gameTables.id),
    reason: reportReason('reason').notNull(),
    details: text('details').notNull().default(''),
    status: reportStatus('status').notNull().default('open'),
    // The admin who closed it. Not a foreign key, like `events.actor_id`.
    resolvedBy: uuid('resolved_by'),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (report) => [
    // One report still waiting per reporter and target: a repeat is refused, not queued twice.
    uniqueIndex('reports_open_unique')
      .on(report.reporterId, report.targetType, report.targetId)
      .where(sql`${report.status} IN ('open', 'reviewing')`),
    // The admin queue, filtered by status, newest first.
    index('reports_status_created_idx').on(report.status, report.createdAt),
    // Mirror REPORT_DETAILS_MAX and RESOLUTION_NOTE_MAX in $lib/moderation/reports.
    check('reports_details_length', sql`char_length(${report.details}) <= 1000`),
    check('reports_resolution_note_length', sql`char_length(${report.resolutionNote}) <= 1000`),
    check(
      'reports_table_target',
      sql`${report.targetType} <> 'table' OR ${report.targetId} = ${report.tableId}`,
    ),
    // A table or player report always says which table. Written without 'crowdfunding' or 'partner': a value
    // added to the enum cannot be used in the migration that adds it.
    check(
      'reports_table_required',
      sql`${report.targetType} NOT IN ('table', 'player') OR ${report.tableId} IS NOT NULL`,
    ),
  ],
).enableRLS();

// Mirrors CROWDFUNDING_PLATFORMS in $lib/crowdfunding/platforms. Read from the link's host when a
// campaign is added, and kept so the list can filter on it.
export const crowdfundingPlatform = pgEnum('crowdfunding_platform', [
  'catarse',
  'meeplestarter',
  'kickstarter',
  'benfeitoria',
  'gamefound',
  'other',
]);

// A crowdfunding campaign for an RPG or tabletop game that a member shared. It is public as soon as
// it is added; members report it and admins remove it (`removedAt`). Where it stands (soon, running,
// ended) is worked out from the dates and never stored.
export const crowdfundings = pgTable(
  'crowdfundings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The member who added it, credited as "Enviado por".
    submitterId: uuid('submitter_id').references(() => profiles.id),
    origin: text('origin', { enum: ['member', 'import'] })
      .notNull()
      .default('member'),
    importSource: text('import_source', { enum: ['catarse', 'meeplestarter'] }),
    // The canonical https link (`normalizeCampaignUrl`): the address that was checked is the one that
    // is stored, shown and opened, and what the unique index compares.
    url: text('url').notNull(),
    platform: crowdfundingPlatform('platform').notNull(),
    name: text('name').notNull(),
    // Free text: the publisher, studio or person behind the campaign.
    owner: text('owner').notNull(),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    // A path in the table images bucket, or null: the tile then shows the chest and the host.
    imagePath: text('image_path'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    // The admin who removed it, and why. Not a foreign key, like `reports.resolved_by`.
    removedBy: uuid('removed_by'),
    removalReason: reportReason('removal_reason'),
    removalNote: text('removal_note'),
    ...timestamps,
  },
  (campaign) => [
    // One campaign per link while it is up: a repeat points at the existing one.
    uniqueIndex('crowdfundings_url_unique')
      .on(campaign.url)
      .where(sql`${campaign.removedAt} IS NULL`),
    index('crowdfundings_url_all_idx').on(campaign.url),
    check(
      'crowdfundings_origin',
      sql`(${campaign.origin} = 'member' AND ${campaign.submitterId} IS NOT NULL AND ${campaign.importSource} IS NULL) OR (${campaign.origin} = 'import' AND ${campaign.submitterId} IS NULL AND ${campaign.importSource} IS NOT NULL AND ${campaign.importSource} IN ('catarse', 'meeplestarter'))`,
    ),
    index('crowdfundings_ends_on_idx').on(campaign.endsOn),
    index('crowdfundings_submitter_idx').on(campaign.submitterId),
    // Mirror CROWDFUNDING_NAME_MAX, CROWDFUNDING_OWNER_MAX and the note limit in $lib/crowdfunding/schema.
    check('crowdfundings_name_length', sql`char_length(${campaign.name}) BETWEEN 1 AND 120`),
    check('crowdfundings_owner_length', sql`char_length(${campaign.owner}) BETWEEN 1 AND 80`),
    check('crowdfundings_dates_order', sql`${campaign.endsOn} >= ${campaign.startsOn}`),
    check('crowdfundings_removal_note_length', sql`char_length(${campaign.removalNote}) <= 1000`),
  ],
).enableRLS();

// A community, shop, podcast or event that links to Mesa Aberta and is listed on /partners in return
// (a link exchange). A member sends it, an admin approves it (`approvedAt`), members report it and an
// admin removes it (`removedAt`). The submitter is shown to admins only. Any edit by the submitter
// clears the approval, so the card leaves the page until an admin approves it again.
export const partners = pgTable(
  'partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submitterId: uuid('submitter_id')
      .notNull()
      .references(() => profiles.id),
    name: text('name').notNull(),
    description: text('description'),
    // A path in the profile-avatars bucket, under `partners/<submitter id>/`.
    logoPath: text('logo_path').notNull(),
    // The partner's own site, if any. The networks are in `partner_links`.
    siteUrl: text('site_url'),
    // How an admin can reach the partner. Optional, and for admins only: no public query selects it.
    contactEmail: text('contact_email'),
    // Where the partner put our link, for the admin to check. Optional.
    backlinkUrl: text('backlink_url'),
    // A discount the partner gives Mesa Aberta members, when there is a coupon partnership: the code,
    // and a line saying what it gives. Both optional; a description needs a code.
    couponCode: text('coupon_code'),
    couponDescription: text('coupon_description'),
    // Null while the partner waits for an admin (or after an edit); the list shows approved ones only.
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    // The admin who approved it. Not a foreign key, like `crowdfundings.removed_by`.
    approvedBy: uuid('approved_by'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    // The admin who removed or rejected it, or the submitter themself (then there is no reason).
    removedBy: uuid('removed_by'),
    removalReason: reportReason('removal_reason'),
    removalNote: text('removal_note'),
    ...timestamps,
  },
  (partner) => [
    index('partners_submitter_idx').on(partner.submitterId),
    // The public list and the admin's waiting list.
    index('partners_approved_idx').on(partner.approvedAt, partner.removedAt),
    // Mirror PARTNER_LIMITS in $lib/partners/schema.
    check('partners_name_length', sql`char_length(${partner.name}) BETWEEN 1 AND 60`),
    check('partners_contact_email_length', sql`char_length(${partner.contactEmail}) <= 254`),
    check('partners_description_length', sql`char_length(${partner.description}) <= 140`),
    check('partners_coupon_code_length', sql`char_length(${partner.couponCode}) BETWEEN 1 AND 32`),
    check(
      'partners_coupon_description_length',
      sql`char_length(${partner.couponDescription}) <= 140`,
    ),
    check(
      'partners_coupon_description_needs_code',
      sql`${partner.couponDescription} IS NULL OR ${partner.couponCode} IS NOT NULL`,
    ),
    check('partners_removal_note_length', sql`char_length(${partner.removalNote}) <= 1000`),
  ],
).enableRLS();

// One link of a partner: a social network, in the order the member put them (at most
// MAX_PARTNER_LINKS). The site is `partners.site_url`, so `network` is never `website` here.
export const partnerLinks = pgTable(
  'partner_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    // One of the networks in `$lib/profile/social-links`, except `website`.
    network: text('network').notNull(),
    url: text('url').notNull(),
    position: integer('position').notNull(),
  },
  (link) => [
    index('partner_links_partner_idx').on(link.partnerId, link.position),
    check('partner_links_network', sql`${link.network} <> 'website'`),
  ],
).enableRLS();

// Source identities survive moderation; no public Data API policies.
export const crowdfundingImports = pgTable(
  'crowdfunding_imports',
  {
    source: text('source', { enum: ['catarse', 'meeplestarter'] }).notNull(),
    externalId: text('external_id').notNull(),
    crowdfundingId: uuid('crowdfunding_id')
      .notNull()
      .references(() => crowdfundings.id),
    canonicalUrl: text('canonical_url').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.externalId] }),
    index('crowdfunding_imports_campaign_idx').on(t.crowdfundingId),
    check('crowdfunding_imports_source', sql`${t.source} IN ('catarse','meeplestarter')`),
  ],
).enableRLS();

export const crowdfundingImportRuns = pgTable(
  'crowdfunding_import_runs',
  {
    source: text('source', { enum: ['catarse', 'meeplestarter'] }).notNull(),
    runDate: date('run_date', { mode: 'string' }).notNull(),
    status: text('status', { enum: ['running', 'complete', 'partial', 'failed'] }).notNull(),
    token: uuid('token').notNull(),
    leaseUntil: timestamp('lease_until', { withTimezone: true }).notNull(),
    cursor: text('cursor'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    counters: jsonb('counters').$type<Record<string, number>>().notNull().default({}),
    errorCode: text('error_code'),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.runDate] }),
    check('crowdfunding_import_runs_source', sql`${t.source} IN ('catarse','meeplestarter')`),
    check(
      'crowdfunding_import_runs_status',
      sql`${t.status} IN ('running','complete','partial','failed')`,
    ),
  ],
).enableRLS();
