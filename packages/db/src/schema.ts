import { TABLE_STATUSES } from './table-status';
import { PROFILE_STATUSES } from './profile-status';
import { sql } from 'drizzle-orm';
import {
  bigint,
  type AnyPgColumn,
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
    // The cover at the top of the public profile, in the same bucket (`<id>/banners/…`). Optional.
    bannerPath: text('banner_path'),
    // A few lines in the person's own words, shown as plain text on the public profile. Optional.
    bio: text('bio'),
    // Off by default: `name` may have come from the sign-in provider, so it is public only once the
    // person says so, as a line under the @usuário.
    showName: boolean('show_name').notNull().default(false),
    // On: the favorite systems show as pills on the public profile. They still shape the person's
    // own Início either way.
    showFavoriteSystems: boolean('show_favorite_systems').notNull().default(true),
    // Whether a notice arrives when someone this person follows opens a table, or a seat opens on a
    // full table of theirs.
    followNotifyTables: boolean('follow_notify_tables').notNull().default(true),
    followNotifySeats: boolean('follow_notify_seats').notNull().default(true),
    // The IANA zone times are shown in (`America/Sao_Paulo`). Null until the person picks one: the
    // browser's zone is used meanwhile (see `viewerTimezone`).
    timezone: text('timezone'),
    // Off: nobody can start a direct message with this person, and existing ones stop taking new
    // messages. Table chats are not affected.
    directMessagesEnabled: boolean('direct_messages_enabled').notNull().default(true),
    invitationsEnabled: boolean('invitations_enabled').notNull().default(true),
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
    // Mirrors RESOLUTION_NOTE_MAX in apps/web/src/lib/moderation/reports.
    check('profiles_ban_reason_length', sql`char_length(${profile.banReason}) <= 1000`),
    // Mirrors PROFILE_LIMITS.bio in packages/core/src/profile/schema.
    check('profiles_bio_length', sql`char_length(${profile.bio}) <= 300`),
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
    // One of the networks in `#lib/profile/social-links`, or `website`.
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
    // A suggestion goes after the seeded ones.
    position: integer('position').notNull().default(1000),
    // Like a platform or a tag: only an approved system is public. A GM may suggest one while
    // opening a table, which then stays a draft until an admin approves it.
    status: catalogStatus('status').notNull().default('approved'),
    suggestedBy: uuid('suggested_by').references(() => profiles.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    // A duplicate merged into another system points at it.
    mergedInto: uuid('merged_into'),
    ...timestamps,
  },
  (system) => [
    uniqueIndex('systems_slug_unique').on(system.slug),
    uniqueIndex('systems_name_unique').on(system.name),
  ],
).enableRLS();

// The systems a person likes to play, which shape their Início. At most
// FAVORITE_SYSTEMS_MAX each, held by the service, not the database.
export const profileFavoriteSystems = pgTable(
  'profile_favorite_systems',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (favorite) => [
    primaryKey({ columns: [favorite.profileId, favorite.systemId] }),
    index('profile_favorite_systems_system_idx').on(favorite.systemId),
  ],
).enableRLS();

// Who follows whom: anyone, quem mestra or quem joga. Only the followed person sees how many
// follow them.
export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (follow) => [
    primaryKey({ columns: [follow.followerId, follow.followeeId] }),
    index('follows_followee_idx').on(follow.followeeId),
    check('follows_not_self', sql`${follow.followerId} <> ${follow.followeeId}`),
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
    // Generated from the title; it is the table's public URL (`/t/<slug>`).
    slug: text('slug').notNull(),
    joinMode: joinMode('join_mode').notNull().default('auto'),
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id),
    title: text('title').notNull(),
    imagePath: text('image_path'),
    // Only the immediate source constrains this session; deleting it keeps the independent copy.
    duplicatedFromTableId: uuid('duplicated_from_table_id').references(
      (): AnyPgColumn => gameTables.id,
      { onDelete: 'set null' },
    ),
    duplicationRequestKey: uuid('duplication_request_key'),
    // Not an event FK: outbox retention must not erase submission idempotency.
    duplicationEventId: uuid('duplication_event_id'),
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
    // How many sessions an adventure plans, so the table can say "sessão 2 de 4". Only adventures
    // have one; null on the others, and on adventures made before the field existed.
    plannedSessions: integer('planned_sessions'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    timezone: text('timezone').notNull(),
    // An iCalendar RRULE for a campaign; null for a one-shot.
    recurrence: text('recurrence'),
    until: timestamp('until', { withTimezone: true }),
    status: tableStatus('status').notNull().default('active'),
    // When the table went public: set on creation for an active table and when a draft is published,
    // so "Novas mesas" counts a draft from its publication, not from when it was written.
    publishedAt: timestamp('published_at', { withTimezone: true }),
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
    index('game_tables_duplicated_from_idx').on(table.duplicatedFromTableId),
    uniqueIndex('game_tables_duplication_request_unique').on(
      table.gmId,
      table.duplicationRequestKey,
    ),
    index('game_tables_system_id_idx').on(table.systemId),
    index('game_tables_status_published_idx').on(table.status, table.publishedAt),
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
    check(
      'game_tables_planned_sessions_range',
      sql`${table.plannedSessions} IS NULL OR (${table.kind}::text = 'adventure' AND ${table.plannedSessions} BETWEEN 2 AND 20)`,
    ),
    check('game_tables_duration_positive', sql`${table.durationMinutes} > 0`),
    check(
      'game_tables_in_person_has_area',
      sql`${table.modality} = 'online' OR ${table.locationArea} IS NOT NULL`,
    ),
    // Mirror TABLE_LIMITS in apps/web/src/lib/tables/schema.
    check('game_tables_location_area_length', sql`char_length(${table.locationArea}) <= 120`),
    // Both are rich-text HTML: the visible limit (1000) times RICH_HTML_FACTOR in apps/web/src/lib/text/rich-schema.
    check('game_tables_join_details_length', sql`char_length(${table.joinDetails}) <= 6000`),
    check('game_tables_welcome_message_length', sql`char_length(${table.welcomeMessage}) <= 6000`),
    // Mirrors RESOLUTION_NOTE_MAX in apps/web/src/lib/moderation/reports.
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
    // Who holds the lease: a fresh token per claim. A dispatcher whose lease expired and was taken
    // over cannot finish or release the new claim, because its token no longer matches.
    claimToken: uuid('claim_token'),
    // The shape of `payload` when the event was written. A consumer branches on it when a payload
    // changes, so old rows and in-flight messages stay readable.
    version: integer('version').notNull().default(1),
    // Set once a bus adapter (Cloudflare Queues) has accepted the event. Null while the event only
    // lives in the outbox, and for every event written before the bus existed.
    publishedAt: timestamp('published_at', { withTimezone: true }),
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
    // Whether the player showed up, said by the GM when the session is confirmed. Null while it is
    // not recorded (before the session, and every session confirmed before attendance existed): only
    // a false blocks rating the GM.
    attended: boolean('attended'),
    // When the GM let the player rate before the table was concluded (a campaign or adventure that
    // goes on). Null: the player rates once the table is concluded, as for any table.
    ratingOpenedAt: timestamp('rating_opened_at', { withTimezone: true }),
    ...timestamps,
  },
  (registration) => [
    primaryKey({ columns: [registration.tableId, registration.playerId] }),
    index('registrations_player_idx').on(registration.playerId),
    // Mirror JOIN_MESSAGE_MAX in apps/web/src/lib/tables/registration.
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
    // The player chose to show the comment on the GM's public profile, with their @usuário and the
    // score. Off by default: a comment written before this choice existed stays private.
    commentPublic: boolean('comment_public').notNull().default(false),
    ...timestamps,
  },
  (rating) => [
    primaryKey({ columns: [rating.tableId, rating.playerId] }),
    check('ratings_gm_score_range', sql`${rating.gmScore} BETWEEN 1 AND 5`),
    check('ratings_comment_length', sql`char_length(${rating.comment}) <= 1000`),
    index('ratings_table_idx').on(rating.tableId),
  ],
).enableRLS();

// What the GM of a table thought of a player they marked present: the other side of `ratings`. The
// score counts for the player's public score "como participante"; the comment is the GM's own note
// and nobody else sees it. Made once per player and table, and final. It goes with its table, with
// the rated player's account, and loses its comment with the GM's (see `closeAccount`).
export const playerRatings = pgTable(
  'player_ratings',
  {
    tableId: uuid('table_id')
      .notNull()
      .references(() => gameTables.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => profiles.id),
    score: smallint('score').notNull(),
    comment: text('comment'),
    ...timestamps,
  },
  (rating) => [
    primaryKey({ columns: [rating.tableId, rating.playerId] }),
    check('player_ratings_score_range', sql`${rating.score} BETWEEN 1 AND 5`),
    check('player_ratings_comment_length', sql`char_length(${rating.comment}) <= 1000`),
    index('player_ratings_player_idx').on(rating.playerId),
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

// The e-mailed code that lets someone who signed in with a provider add a password (the api's
// `POST /v1/account/password`). One live code per person: asking again replaces it. `code_hash` is a
// hash keyed by the person, never the code; a code dies on use, after `attempts` wrong guesses or
// when it expires. Supabase's own reauthentication nonce cannot stand in for this: it is only
// checked when the session is older than a day.
export const passwordSetupCodes = pgTable('password_setup_codes', {
  profileId: uuid('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}).enableRLS();

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
  // A badge was earned (see `userBadges`).
  'achievements',
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
    // When the row was written, which can be later than `created_at` (the event's time) when the
    // handler ran late. "Mark all read" stops at what the person could have seen by this time.
    writtenAt: timestamp('written_at', { withTimezone: true }).notNull().defaultNow(),
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

// The badges a person holds, one row per person and badge. The catalog (name, icon, rule) lives in
// code and `badge_id` is its stable id, never renamed (like a handler name), so it is not a foreign
// key. A row is `insert ... on conflict do nothing`, which makes awarding safe to repeat. A revoked
// badge keeps its row, so the next event does not award it again. The rows go when the account is
// closed (see `anonymiseProfile`), and the profile row stays, so no cascade does it.
export const userBadges = pgTable(
  'user_badges',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    badgeId: text('badge_id').notNull(),
    // When it was earned: the event's time, or the qualifying row's date for a backfill.
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
    // The event that tipped it. Not a foreign key: events are pruned. Null for a backfill or a grant.
    sourceEventId: uuid('source_event_id'),
    // The admin who granted it by hand; null when a rule awarded it.
    grantedBy: uuid('granted_by').references(() => profiles.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
    // The person chose not to show it on their profile.
    hidden: boolean('hidden').notNull().default(false),
  },
  (badge) => [
    primaryKey({ columns: [badge.profileId, badge.badgeId] }),
    // Who holds a badge, for the admin catalog's counts.
    index('user_badges_badge_idx').on(badge.badgeId),
    check('user_badges_badge_id_format', sql`${badge.badgeId} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    // A reason only comes with a revocation. Mirrors the reason limit of a report's resolution note.
    check(
      'user_badges_revoke_reason',
      sql`${badge.revokeReason} IS NULL OR (${badge.revokedAt} IS NOT NULL AND char_length(${badge.revokeReason}) <= 1000)`,
    ),
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
    // Mirrors MESSAGE_MAX_LENGTH in apps/web/src/lib/messages/schema.
    check('messages_body_length', sql`char_length(${message.body}) BETWEEN 1 AND 2000`),
  ],
).enableRLS();

// Mirror REPORT_TARGETS, REPORT_REASONS and REPORT_STATUSES in apps/web/src/lib/moderation/reports.
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
    // Mirror REPORT_DETAILS_MAX and RESOLUTION_NOTE_MAX in apps/web/src/lib/moderation/reports.
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

// Mirrors CROWDFUNDING_PLATFORMS in apps/web/src/lib/crowdfunding/platforms. Read from the link's host when a
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
    // Mirror CROWDFUNDING_NAME_MAX, CROWDFUNDING_OWNER_MAX and the note limit in apps/web/src/lib/crowdfunding/schema.
    check('crowdfundings_name_length', sql`char_length(${campaign.name}) BETWEEN 1 AND 120`),
    check('crowdfundings_owner_length', sql`char_length(${campaign.owner}) BETWEEN 1 AND 80`),
    check('crowdfundings_dates_order', sql`${campaign.endsOn} >= ${campaign.startsOn}`),
    check('crowdfundings_removal_note_length', sql`char_length(${campaign.removalNote}) <= 1000`),
  ],
).enableRLS();

// A community, shop, podcast or event that links to Mesa Aberta and is listed on /partners in return
// (a link exchange). A member sends it, an admin approves it (`approvedAt`), members report it and an
// admin removes it (`removedAt`). Who looks after it (`partner_owners`) is shown to admins and to
// those accounts only. Any edit by an owner clears the approval, so the card leaves the page until
// an admin approves it again.
export const partners = pgTable(
  'partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submitterId: uuid('submitter_id')
      .notNull()
      .references(() => profiles.id),
    name: text('name').notNull(),
    description: text('description'),
    // What it is: one to three slugs of PARTNER_TYPES (`@mesaaberta/core/partners/types`), in that
    // list's order. Empty only for a partner sent before there were types, until someone picks.
    types: text('types')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    // Mirror PARTNER_LIMITS in apps/web/src/lib/partners/schema.
    check('partners_name_length', sql`char_length(${partner.name}) BETWEEN 1 AND 60`),
    check('partners_contact_email_length', sql`char_length(${partner.contactEmail}) <= 254`),
    check('partners_description_length', sql`char_length(${partner.description}) <= 140`),
    // Mirror MAX_PARTNER_TYPES and PARTNER_TYPES.
    check('partners_types_count', sql`cardinality(${partner.types}) <= 3`),
    check(
      'partners_types_known',
      sql`${partner.types} <@ ARRAY['publisher', 'shop', 'content', 'podcast', 'collective', 'community', 'event', 'venue', 'art', 'translation', 'platform', 'other']::text[]`,
    ),
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
    // One of the networks in `#lib/profile/social-links`, except `website`.
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

/**
 * When a background job last finished a run (`sweeper` today). The web Worker's /healthz reads it,
 * because the background Worker has no route of its own to probe.
 */
export const workerHeartbeats = pgTable('worker_heartbeats', {
  name: text('name').primaryKey(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }).notNull(),
}).enableRLS();

// Consent-based invitations are not registrations; pending rows reserve seats without membership.
export const invitationStatus = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
  'cancelled',
]);
export const playerInvitations = pgTable(
  'player_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tableId: uuid('table_id')
      .notNull()
      .references(() => gameTables.id, { onDelete: 'cascade' }),
    gmId: uuid('gm_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    status: invitationStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
  },
  (t) => [
    uniqueIndex('player_invitations_pending_unique')
      .on(t.tableId, t.playerId)
      .where(sql`${t.status} = 'pending'`),
    index('player_invitations_table_status_idx').on(t.tableId, t.status, t.expiresAt),
    index('player_invitations_player_idx').on(t.playerId, t.status),
    index('player_invitations_gm_created_idx').on(t.gmId, t.createdAt),
    check('player_invitations_not_self', sql`${t.gmId} <> ${t.playerId}`),
    check('player_invitations_expiry', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
).enableRLS();

// Declined invitations stay in player_invitations even when the outbox is pruned.
export const gmInviteBlocks = pgTable(
  'gm_invite_blocks',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    gmId: uuid('gm_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.gmId] }),
    check('gm_invite_blocks_not_self', sql`${t.playerId} <> ${t.gmId}`),
  ],
).enableRLS();

// The member accounts that look after a partner (at most MAX_PARTNER_OWNERS): they edit it, invite
// other accounts, take accounts off and hear from moderation. All are equal. The submitter is the
// first row; `partners.submitter_id` only says who sent it. A partner sent before this table, or
// in the minutes between this migration and the deploy, may have no row: then its submitter is
// its one owner (`ownersOf`).
export const partnerOwners = pgTable(
  'partner_owners',
  {
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    // Who invited them; null for the submitter. Not a foreign key: the inviter may leave.
    invitedBy: uuid('invited_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.partnerId, t.profileId] }),
    index('partner_owners_profile_idx').on(t.profileId),
  ],
).enableRLS();

// An owner asks another account to look after the partner too. It counts only once accepted. A
// pending one past `expires_at` has lapsed even before anything marks it.
export const partnerInvitations = pgTable(
  'partner_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    status: invitationStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('partner_invitations_pending_unique')
      .on(t.partnerId, t.inviteeId)
      .where(sql`${t.status} = 'pending'`),
    index('partner_invitations_partner_idx').on(t.partnerId, t.status),
    index('partner_invitations_invitee_idx').on(t.inviteeId, t.status),
    check('partner_invitations_not_self', sql`${t.inviterId} <> ${t.inviteeId}`),
    check('partner_invitations_expiry', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
).enableRLS();

// Widgets an extension floats over the app's pages, a poll today (Trello #231). The tables live here,
// not in the private package, so every deployment keeps one schema; a build without that extension
// never reads them.
export const widgetStatus = pgEnum('widget_status', ['draft', 'live', 'paused', 'closed']);

export const widgets = pgTable(
  'widgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Which component shows it (`poll`). Text, so a new kind needs no migration.
    kind: text('kind').notNull(),
    // The admin's own name for it; never shown to members.
    title: text('title').notNull(),
    status: widgetStatus('status').notNull().default('draft'),
    // SvelteKit route ids it shows on (`/t/[slug]`), or `*` for every page.
    placements: text('placements')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Who sees it: segments of `@mesaaberta/core/server/audience/segments`, any of `include` (all
    // when empty) minus any of `exclude`.
    audience: jsonb('audience')
      .$type<{ include: string[]; exclude: string[] }>()
      .notNull()
      .default({ include: [], exclude: [] }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    // The highest shows first when several fit a page.
    priority: integer('priority').notNull().default(0),
    // How many people the audience reached when it went live, for the turnout.
    publishedReach: integer('published_reach'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (widget) => [
    index('widgets_live_idx')
      .on(widget.priority)
      .where(sql`${widget.status} = 'live'`),
    check('widgets_kind_format', sql`${widget.kind} ~ '^[a-z][a-z0-9-]*$'`),
    check('widgets_title_length', sql`char_length(${widget.title}) BETWEEN 1 AND 120`),
    check(
      'widgets_window',
      sql`${widget.startsAt} IS NULL OR ${widget.endsAt} IS NULL OR ${widget.endsAt} > ${widget.startsAt}`,
    ),
  ],
).enableRLS();

export const pollChoice = pgEnum('poll_choice', ['single', 'multiple']);
// Who sees the results: admins only, each person after voting, or anyone (with a minimum of votes).
export const pollResults = pgEnum('poll_results', ['admin', 'after_vote', 'public']);

export const polls = pgTable(
  'polls',
  {
    widgetId: uuid('widget_id')
      .primaryKey()
      .references(() => widgets.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    description: text('description'),
    choice: pollChoice('choice').notNull().default('single'),
    // With `multiple`: at most this many options; null means any number.
    maxChoices: smallint('max_choices'),
    results: pollResults('results').notNull().default('admin'),
    // Public results wait for this many votes, so a handful of answers cannot be traced to anyone.
    publicMinVotes: smallint('public_min_votes').notNull().default(10),
    allowChange: boolean('allow_change').notNull().default(false),
  },
  (poll) => [
    check('polls_question_length', sql`char_length(${poll.question}) BETWEEN 1 AND 300`),
    check('polls_description_length', sql`char_length(${poll.description}) <= 500`),
    check('polls_max_choices', sql`${poll.maxChoices} IS NULL OR ${poll.maxChoices} >= 2`),
    check('polls_public_min_votes', sql`${poll.publicMinVotes} >= 0`),
  ],
).enableRLS();

export const pollOptions = pgTable(
  'poll_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.widgetId, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    position: smallint('position').notNull(),
    // An option that has votes is hidden, never deleted, so the counts stay honest.
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  },
  (option) => [
    index('poll_options_poll_idx').on(option.pollId, option.position),
    check('poll_options_label_length', sql`char_length(${option.label}) BETWEEN 1 AND 120`),
  ],
).enableRLS();

// One row per option a person picked. Personal data: only counts ever leave the admin, and
// closing an account deletes the person's rows (the extension's `onAccountClosed`).
export const pollVotes = pgTable(
  'poll_votes',
  {
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.widgetId, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (vote) => [
    primaryKey({ columns: [vote.pollId, vote.profileId, vote.optionId] }),
    index('poll_votes_option_idx').on(vote.pollId, vote.optionId),
  ],
).enableRLS();

// "Agora não": hidden for a while the first time, for good the second (the extension decides).
export const widgetDismissals = pgTable(
  'widget_dismissals',
  {
    widgetId: uuid('widget_id')
      .notNull()
      .references(() => widgets.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
    times: smallint('times').notNull().default(1),
  },
  (dismissal) => [primaryKey({ columns: [dismissal.widgetId, dismissal.profileId] })],
).enableRLS();
