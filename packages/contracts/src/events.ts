// Runtime-neutral: no database, framework or platform imports. The web app, the API and the worker
// all agree on the events through this package.

/** The icons an admin can pick for an announcement. */
export const ANNOUNCEMENT_ICONS = [
  'megaphone',
  'wrench',
  'alert-triangle',
  'sparkles',
  'gift',
  'info',
] as const;
export type AnnouncementIcon = (typeof ANNOUNCEMENT_ICONS)[number];

/** How an announcement reads: news, a warning (maintenance) or plain information. */
export const ANNOUNCEMENT_TONES = ['info', 'warning', 'announcement'] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];

/** Who an announcement goes to. Every audience is limited to active accounts. */
export const ANNOUNCEMENT_AUDIENCES = [
  'all_active_users',
  'game_masters',
  'active_players',
  'specific_user',
] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

/**
 * Domain events, and what each one carries. The payload holds ids and public facts only, never an
 * email address or a token: it is kept forever as the audit log. Later slices add their events here.
 */
export type DomainEvent =
  | { type: 'PlayerInvited'; payload: PlayerInvitationFact }
  | { type: 'InvitationAccepted'; payload: PlayerInvitationFact }
  | { type: 'InvitationDeclined'; payload: PlayerInvitationFact }
  | { type: 'InvitationExpired'; payload: PlayerInvitationFact }
  | { type: 'InvitationCancelled'; payload: PlayerInvitationFact }

  // A table went public: opened directly, or a draft its GM published (`fromDraft`).
  | {
      type: 'TableCreated';
      payload: { tableId: string; slug: string; title: string; fromDraft?: true };
    }
  // The GM saved a table as a draft. Nobody else sees it and nobody is told.
  | { type: 'TableDrafted'; payload: { tableId: string; slug: string; title: string } }
  // Minimal audit, under the ordinary event retention. No draft content survives deletion.
  | { type: 'TableDraftDeleted'; payload: { tableId: string } }
  // The GM edited something players see (the invite and the bell follow it) or moved the session.
  // `changes` says what, for the history an admin reads; rows from before it have none.
  | { type: 'TableUpdated'; payload: TableChange }
  // The GM edited only what players do not see (seats, join mode, welcome message, image, tags).
  // Nobody is told: it is for the history alone, and no handler listens to it.
  | { type: 'TableEdited'; payload: TableChange }
  | {
      type: 'TableDisabled';
      payload: {
        tableId: string;
        slug: string;
        title: string;
        draft?: true;
        cancelledRequestPlayerIds?: string[];
      };
    }
  // The session is over and the GM has not said whether it happened (the sweeper records it, with no actor).
  | { type: 'TableAwaitingConfirmation'; payload: { tableId: string; slug: string; title: string } }
  // The GM still has not answered: the sweeper e-mails them an hour after the session ended (`1h`)
  // and again a week after (`7d`), the last notice before the session is settled for them.
  | {
      type: 'TableCloseReminder';
      payload: { tableId: string; slug: string; title: string; step: '1h' | '7d' };
    }
  // The GM confirmed the session happened, or that it did not.
  // `absentPlayerIds` are the confirmed players the GM said did not show up (they cannot rate the
  // GM and are not asked to). Absent when attendance was not recorded.
  // `autoClosed`: nobody answered in ten days, so the sweeper concluded the one-shot (no actor), and
  // every confirmed player is asked to rate by e-mail as well as in the bell.
  | {
      type: 'TableConcluded';
      payload: {
        tableId: string;
        slug: string;
        title: string;
        absentPlayerIds?: string[];
        autoClosed?: true;
      };
    }
  // A session of a campaign or adventure happened and more follow: the table stays open for the next
  // one (`nextStartsAt`, ISO). `absentPlayerIds` as in `TableConcluded`.
  | {
      type: 'TableSessionHeld';
      payload: {
        tableId: string;
        slug: string;
        title: string;
        nextStartsAt: string;
        absentPlayerIds?: string[];
        // Nobody answered in ten days, so the sweeper held it (no actor) and moved to the next date.
        autoClosed?: true;
      };
    }
  // The GM let these players rate a table that is still going. Each rates once, whatever the sessions.
  // `autoClosed`: the sweeper did, with the session it held for the GM; the players are e-mailed too.
  | {
      type: 'RatingsOpened';
      payload: {
        tableId: string;
        slug: string;
        title: string;
        playerIds: string[];
        autoClosed?: true;
      };
    }
  | { type: 'TableNotHeld'; payload: { tableId: string; slug: string; title: string } }
  // A player asked for a seat at a table that approves each one. Takes no seat.
  | { type: 'JoinRequested'; payload: Registration }
  | { type: 'JoinApproved'; payload: Registration }
  | { type: 'JoinDeclined'; payload: Registration }
  // A seat was confirmed by an automatic join. An approval records `JoinApproved` alone, so a player is never told twice.
  | { type: 'PlayerJoined'; payload: Registration }
  // `wasFull`: the table had no seat left before this one was given up (followers of its GM hear of it).
  | {
      type: 'PlayerLeft';
      payload: Registration & { reason: 'left' | 'removed'; wasFull?: true };
    }
  // A player rated the table and its GM (or changed their rating). Scores and comments are not in the payload.
  | { type: 'RatingSubmitted'; payload: Registration }
  // The GM rated a player they marked present (the actor is the GM). No score or comment either.
  | { type: 'PlayerRated'; payload: Registration }
  // Someone followed a person (the actor is the follower). Unfollowing records nothing.
  | { type: 'FollowStarted'; payload: { followeeId: string } }
  // A person saved their favorite systems: the ids as saved, in no order.
  | { type: 'FavoriteSystemsChanged'; payload: { systemIds: string[] } }
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
  | {
      type: 'CrowdfundingImported';
      payload: CrowdfundingFact & { source: 'catarse' | 'meeplestarter'; externalId: string };
    }
  // The server read a campaign link for a member (to fill the name). No handler listens to it: it
  // only counts against the rate limit, and the address itself is not kept.
  | { type: 'CrowdfundingLinkRead'; payload: Record<string, never> }
  // An admin took a campaign down. `submitterId` is who is told, with the reason.
  | { type: 'CrowdfundingRemoved'; payload: CrowdfundingRemoval }
  // A member sent a partner, or edited one (which clears its approval): it waits for an admin.
  // Nobody is told.
  | { type: 'PartnerAdded'; payload: PartnerFact }
  | { type: 'PartnerUpdated'; payload: PartnerFact & { changes: Changes } }
  // An admin approved a partner: it is on the page. Every account that looks after it is told
  // (`submitterId` alone for a partner with no `partner_owners` row).
  // A rule awarded a badge (never a backfill or a grant). The bell notice is written from this event.
  | { type: 'BadgeEarned'; payload: { profileId: string; badgeId: string } }
  // An admin gave a badge by hand (a manual one, or one revoked earlier given back), or took one
  // away. `reason` is the admin's note for the audit log; the person is told of a grant only.
  | { type: 'BadgeGranted'; payload: { profileId: string; badgeId: string; reason: string } }
  | { type: 'BadgeRevoked'; payload: { profileId: string; badgeId: string; reason: string } }
  | { type: 'PartnerApproved'; payload: PartnerFact & { submitterId: string } }
  // An admin rejected or took a partner down, or one of its owners withdrew it (then `reason` is
  // null and the other owners are told). Who is told as for `PartnerApproved`.
  | { type: 'PartnerRemoved'; payload: PartnerRemoval }
  // An owner of a partner invited another account to look after it, and how that ended. The
  // invitee hears of the invite, the inviter of the answer; a cancelled or lapsed one tells nobody.
  | { type: 'PartnerOwnerInvited'; payload: PartnerInvitationFact }
  | { type: 'PartnerInvitationAccepted'; payload: PartnerInvitationFact }
  | { type: 'PartnerInvitationDeclined'; payload: PartnerInvitationFact }
  | { type: 'PartnerInvitationCancelled'; payload: PartnerInvitationFact }
  | { type: 'PartnerInvitationExpired'; payload: PartnerInvitationFact }
  // An account stopped looking after a partner: taken off by another owner (who tells them), or
  // it left (the actor is `profileId`, so nobody is told).
  | { type: 'PartnerOwnerRemoved'; payload: PartnerFact & { profileId: string } }
  // A member sent an "Onde jogar" place, or its submitter edited it (which clears its approval):
  // it waits for an admin. An admin's edit keeps it up. Nobody is told.
  | { type: 'PlaceSubmitted'; payload: PlaceFact }
  | { type: 'PlaceUpdated'; payload: PlaceFact & { changes: Changes } }
  // An admin approved a place: it is on /places and its tags were rebuilt. The submitter is told.
  | { type: 'PlaceApproved'; payload: PlaceFact & { submitterId: string } }
  // An admin rejected or took a place down, or its submitter withdrew it (then `reason` is null).
  | { type: 'PlaceRemoved'; payload: PlaceRemoval }
  // The report that made more than PLACE_REPORTS_TO_HIDE - 1 open ones hid the place until an admin
  // acts: every admin gets a high alert, its submitter and owner a neutral notice.
  | { type: 'PlaceHidden'; payload: PlaceKeepers & { reportId: string } }
  // An admin put a hidden place back, dismissing the reports that hid it. Its keepers are told.
  | { type: 'PlaceRestored'; payload: PlaceKeepers }
  // A member asked to manage a place; an admin approved (they own it now) or rejected the claim.
  // The claimant hears the decision. The contact they gave is never in the log.
  | { type: 'PlaceClaimed'; payload: PlaceClaimFact }
  | { type: 'PlaceClaimApproved'; payload: PlaceClaimFact }
  | { type: 'PlaceClaimRejected'; payload: PlaceClaimFact }
  // A place lost its owner: they handed it back (`actorId` is `profileId`), or an admin took them
  // off (then they are told).
  | { type: 'PlaceOwnerRemoved'; payload: PlaceFact & { profileId: string } }
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
  | { type: 'EventForced'; payload: { eventId: string; eventType: string } }
  // An admin opened a section of the admin area (`/admin/users`), at most once per section in
  // half an hour: who looked at what, for the audit log.
  | { type: 'AdminAreaEntered'; payload: { section: string } };

/** What an edit changed, per field. A hidden field says that it changed, never the value. */
export type FieldChange =
  | { from: string | number | boolean | null; to: string | number | boolean | null }
  | { redacted: true };
export type Changes = Record<string, FieldChange>;

export type TableChange = {
  tableId: string;
  slug: string;
  title: string;
  changes?: Changes;
  /** Set while the table is a draft: there is nobody to invite or to tell. */
  draft?: true;
};

// `reportId` is null when an admin closed the table from the tables list, with no report behind it.
export type TableClosure = {
  tableId: string;
  slug: string;
  title: string;
  reportId: string | null;
};

export type ReportFiled = {
  reportId: string;
  targetType: 'table' | 'player' | 'crowdfunding' | 'partner' | 'message' | 'person' | 'place';
  targetId: string;
  // Null for a report about a crowdfunding campaign or a partner, which belong to no table, and
  // for one made in a direct conversation.
  tableId: string | null;
  reason:
    | 'spam'
    | 'harassment'
    | 'inappropriate_content'
    | 'no_show'
    | 'other'
    | 'broken_link'
    | 'scam'
    | 'off_topic'
    | 'no_backlink'
    | 'place_closed'
    | 'wrong_address'
    | 'not_public';
};

export type CrowdfundingFact = { crowdfundingId: string; name: string };

// `reportId` is null when an admin removed it from the list, with no report behind it.
export type CrowdfundingRemoval = CrowdfundingFact & {
  submitterId: string | null;
  reason: ReportFiled['reason'];
  reportId: string | null;
};

export type PartnerFact = { partnerId: string; name: string };

// `reason` is null when an owner withdrew it. `reportId` is null with no report behind it.
export type PartnerRemoval = PartnerFact & {
  submitterId: string;
  reason: ReportFiled['reason'] | null;
  reportId: string | null;
};

export type PlaceFact = { placeId: string; slug: string; name: string };

// A claim on a place, and who made it.
export type PlaceClaimFact = PlaceFact & { claimId: string; claimantId: string };

// A place and who looks after it: whoever sent it, and the owner an admin accepted, if any.
export type PlaceKeepers = PlaceFact & { submitterId: string; ownerId: string | null };

// `reason` is null when the submitter withdrew it. `reportId` is null with no report behind it.
export type PlaceRemoval = PlaceFact & {
  submitterId: string;
  reason: ReportFiled['reason'] | null;
  reportId: string | null;
};

export type PartnerInvitationFact = PartnerFact & {
  inviterId: string;
  inviteeId: string;
  invitationId: string;
};

export type ReportClosure = { reportId: string; reporterId: string };

export type CatalogDecision = {
  /** `placeTag` is a place's tag (`place_features`); the rest are what tables pick. */
  kind: 'platform' | 'tag' | 'system' | 'placeTag';
  entryId: string;
  name: string;
};

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
  /** Set when the platform announces a changelog day itself: that day's date, the key it is sent once by. */
  changelogDate?: string;
};

export type EventType = DomainEvent['type'];

/** An event as a handler receives it. `id` is the idempotency key: use it to make a handler safe to repeat. */
export type StoredEvent = DomainEvent & {
  id: string;
  actorId: string | null;
  createdAt: Date;
  attempts: number;
};

export type PlayerInvitationFact = {
  tableId: string;
  slug: string;
  gmId: string;
  playerId: string;
  invitationId: string;
};
