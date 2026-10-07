// Relative imports only across `src/lib/server/events`: the Cron Trigger's Worker entry bundles
// these files without SvelteKit's `$lib` alias.
import type {
  AnnouncementAudience,
  AnnouncementIcon,
  AnnouncementTone,
} from '../../notifications/kinds';

/**
 * Domain events, and what each one carries. The payload holds ids and public facts only, never an
 * email address or a token: it is kept forever as the audit log. Later slices add their events here.
 */
export type DomainEvent =
  | { type: 'TableCreated'; payload: { tableId: string; slug: string; title: string } }
  // The GM edited something players see (the invite and the bell follow it) or moved the session.
  // `changes` says what, for the history an admin reads; rows from before it have none.
  | { type: 'TableUpdated'; payload: TableChange }
  // The GM edited only what players do not see (seats, join mode, welcome message, image, tags).
  // Nobody is told: it is for the history alone, and no handler listens to it.
  | { type: 'TableEdited'; payload: TableChange }
  | { type: 'TableDisabled'; payload: { tableId: string; slug: string; title: string } }
  // The session is over and the GM has not said whether it happened (the sweeper records it, with no actor).
  | { type: 'TableAwaitingConfirmation'; payload: { tableId: string; slug: string; title: string } }
  // The GM confirmed the session happened, or that it did not.
  | { type: 'TableConcluded'; payload: { tableId: string; slug: string; title: string } }
  | { type: 'TableNotHeld'; payload: { tableId: string; slug: string; title: string } }
  // A player asked for a seat at a table that approves each one. Takes no seat.
  | { type: 'JoinRequested'; payload: Registration }
  | { type: 'JoinApproved'; payload: Registration }
  | { type: 'JoinDeclined'; payload: Registration }
  // A seat was confirmed by an automatic join. An approval records `JoinApproved` alone, so a player is never told twice.
  | { type: 'PlayerJoined'; payload: Registration }
  | { type: 'PlayerLeft'; payload: Registration & { reason: 'left' | 'removed' } }
  // A player rated the table and its GM (or changed their rating). Scores and comments are not in the payload.
  | { type: 'RatingSubmitted'; payload: Registration }
  // A session started (OAuth or email/password). This is the connection record Marco Civil da
  // Internet (art. 15) requires kept for 6 months — longer than other events, see CONNECTION_RETENTION_DAYS.
  | { type: 'UserSignedIn'; payload: { ip: string | null } }
  // An admin sent an announcement to the bell. The text is public by nature (everyone in the
  // audience reads it); the one recipient of a `specific_user` announcement is kept by id.
  | { type: 'SystemAnnouncementSent'; payload: SystemAnnouncement }
  // An admin moderated the platform and tag catalog. The names are public; `into` is the entry a
  // merge folded this one into.
  | { type: 'CatalogEntryCreated'; payload: CatalogDecision }
  | { type: 'CatalogEntryApproved'; payload: CatalogDecision }
  | { type: 'CatalogEntryRejected'; payload: CatalogDecision }
  | { type: 'CatalogEntryRenamed'; payload: CatalogDecision & { from: string } }
  | { type: 'CatalogEntryMerged'; payload: CatalogDecision & { into: string } }
  | { type: 'CatalogEntryDisabled'; payload: CatalogDecision }
  // A member reported a table or a player. The details stay on the report row, admins only.
  | { type: 'ReportFiled'; payload: ReportFiled }
  // An admin took a report up, or closed it. `reporterId` is who hears the outcome; the reported
  // party is never told who reported them.
  | { type: 'ReportReviewing'; payload: ReportClosure }
  | { type: 'ReportResolved'; payload: ReportClosure }
  | { type: 'ReportDismissed'; payload: ReportClosure }
  // A member added a crowdfunding campaign. It is public at once; nobody is told.
  | { type: 'CrowdfundingAdded'; payload: CrowdfundingFact }
  // An admin took a campaign down. `submitterId` is who is told, with the reason.
  | { type: 'CrowdfundingRemoved'; payload: CrowdfundingRemoval }
  // An admin closed a table over a report. A `TableDisabled` is recorded with it, for the
  // cancellations; this one tells the GM.
  | { type: 'TableClosedByModeration'; payload: TableClosure }
  // An admin banned an account, from a report or from the user's page: until `until` (an ISO
  // time), or for good when it is null. The person is told by e-mail, with the reason. The ban is
  // revoked by an admin (`AccountReinstated`) or ends by itself at `until` (`AccountBanLifted`).
  | {
      type: 'AccountBanned';
      payload: { profileId: string; until: string | null; reportId: string | null };
    }
  | { type: 'AccountReinstated'; payload: { profileId: string } }
  | { type: 'AccountBanLifted'; payload: { profileId: string } }
  // A person saved their profile. `changes` names the fields; the personal ones (name, age range,
  // gender, city) are hidden, so the log says that they changed and not what they became.
  | { type: 'ProfileUpdated'; payload: { profileId: string; changes: Changes } }
  // An admin ran an event again from the event queue (one is recorded per event, also when they ask
  // for every given-up one). No handler listens to it: it is for the audit log alone.
  | { type: 'EventForced'; payload: { eventId: string; eventType: string } };

/** What an edit changed, per field. A hidden field says that it changed, never the value. */
export type FieldChange =
  | { from: string | number | boolean | null; to: string | number | boolean | null }
  | { redacted: true };
export type Changes = Record<string, FieldChange>;

export type TableChange = { tableId: string; slug: string; title: string; changes?: Changes };

// `reportId` is null when an admin closed the table from the tables list, with no report behind it.
export type TableClosure = {
  tableId: string;
  slug: string;
  title: string;
  reportId: string | null;
};

export type ReportFiled = {
  reportId: string;
  targetType: 'table' | 'player' | 'crowdfunding';
  targetId: string;
  // Null for a report about a crowdfunding campaign, which belongs to no table.
  tableId: string | null;
  reason:
    | 'spam'
    | 'harassment'
    | 'inappropriate_content'
    | 'no_show'
    | 'other'
    | 'broken_link'
    | 'scam'
    | 'off_topic';
};

export type CrowdfundingFact = { crowdfundingId: string; name: string };

// `reportId` is null when an admin removed it from the list, with no report behind it.
export type CrowdfundingRemoval = CrowdfundingFact & {
  submitterId: string;
  reason: ReportFiled['reason'];
  reportId: string | null;
};

export type ReportClosure = { reportId: string; reporterId: string };

export type CatalogDecision = { kind: 'platform' | 'tag'; entryId: string; name: string };

type Registration = { tableId: string; slug: string; playerId: string };

export type SystemAnnouncement = {
  title: string;
  body: string;
  icon: AnnouncementIcon;
  tone: AnnouncementTone;
  link: string | null;
  audience: AnnouncementAudience;
  recipientId: string | null;
  /** How many were in the audience when it was sent: what the admin confirmed. */
  estimated: number;
};

export type EventType = DomainEvent['type'];

/** An event as a handler receives it. `id` is the idempotency key: use it to make a handler safe to repeat. */
export type StoredEvent = DomainEvent & {
  id: string;
  actorId: string | null;
  createdAt: Date;
  attempts: number;
};

/**
 * Something that reacts to events (send an invite, forward to analytics). It runs at least once, so
 * it must be idempotent: a repeat for the same `event.id` must do nothing new. A retry runs only the
 * handlers that have not succeeded yet.
 */
export type Handler = {
  /** Stable and unique: it is recorded when the handler succeeds. Never rename one that has run. */
  name: string;
  types: readonly EventType[];
  /** The dispatcher passes its database connection; handlers must not open a second one. */
  handle(event: StoredEvent, db: import('../db/client').AnyDb): Promise<void>;
};
