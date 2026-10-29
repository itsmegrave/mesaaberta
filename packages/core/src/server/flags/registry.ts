/**
 * Every feature flag the app knows about, with the value used when GrowthBook cannot answer
 * (unreachable, slow, or the flag not created yet). Defaults keep unfinished work hidden, so
 * new flags default to `false`. Create a feature with the same key in GrowthBook.
 */
export const flagDefaults = {
  // Off: the site as usual. On: every visitor gets the maintenance screen; admins still get through.
  maintenance_mode: false,
  // Off: an event's lease is a time only (today's dispatcher). On: each claim carries a token and
  // every update is conditional on it, so a dispatcher whose lease expired cannot finish or release
  // the new claim (ADR 0003). Target admins first: `isAdmin = true`.
  api_events_fenced_leases: false,
  // Off: nothing is published. On: after an event commits its reference (id, type, version) is sent
  // to the `domain-events-canary` queue, whose consumer only counts it (ADR 0003, stage 2). Needs the
  // DOMAIN_EVENTS queue binding; without it this flag does nothing. Target admins first.
  api_events_queue_shadow: false,
  // Off: the analytics handlers run with every other handler, right after the event commits. On:
  // the request leaves them pending and publishes the event's reference, and the queue consumer on
  // the background Worker runs them (ADR 0003, stage 3). The consumer only does so when its
  // QUEUE_LIVE_HANDLERS variable names them; until then the sweeper runs them within five minutes.
  // Needs the DOMAIN_EVENTS queue binding. Target admins first.
  api_events_queue_analytics: false,
  // The same hand-over for the handlers that write the bell's notifications (`bellHandlers`): on,
  // a notification reaches its reader a few seconds later (the queue's batch wait) instead of right
  // after the response. The consumer must name them in QUEUE_LIVE_HANDLERS too. Target admins first.
  api_events_queue_bell: false,
  // The same hand-over for the handlers that send e-mail (`MAIL_HANDLER_NAMES`): calendar invites
  // and the notice of a ban. On, a mail leaves a few seconds later. Resend deduplicates a repeated
  // send for 24 hours only, so watch retries before widening this. The consumer must name the
  // handlers in QUEUE_LIVE_HANDLERS and have the mail settings. Target admins first.
  api_events_queue_mail: false,
  // The one switch for the badge system, off for everyone until it is released (no percentage ramp:
  // it is a new feature). Off hides everything members can see: the "Conquistas" strip and the
  // owner's progress and hide toggle on the profile, the bell notice and the feed filter, and the
  // unread count of those notices. Badges are still earned and stored quietly, so turning it on
  // starts with the history already in place. Targeted by the person's id (profile and bell agree).
  use_badges: false,
  // Off: a new changelog day reaches nobody's bell. On: the first request after a release that
  // carries a changelog day dated within the last three days records one announcement for every
  // active account, linking to that day on /changelog (once per day: the date is the key). Not a
  // ramp: it is one notice. Turning it off stops new days; bells already written stay.
  use_changelog_notices: false,
  // The one switch for quem mestra rating the players they marked present, off for everyone until
  // it is released (a new feature, no percentage ramp). Off hides all of it: the "Avalie quem
  // jogou" card on the manage page (and its action refuses), the score "como participante" on join
  // requests and in the profile's "Mesas jogadas" tile. Targeted by the person's id: the GM on the
  // manage page, the profile's owner on a profile.
  use_player_ratings: false,
  // The one switch for more than one account looking after a partner, off for everyone until it is
  // released (a new feature, no percentage ramp). Off hides "Quem cuida do parceiro" on the edit
  // page and its invite refuses; invites already sent can still be answered. The rest works the
  // same either way: with nobody invited, a partner's one owner is its submitter. Targeted by the
  // person's id.
  use_partner_owners: false,
  // The one switch for the signed-in Início and what feeds it, off for everyone until it is
  // released (admins + 30% first, then everyone). Off hides "Sistemas favoritos" in Editar perfil
  // (the page answers 404) and the favorite systems on public profiles. Targeted by the person's id:
  // the signed-in person in Editar perfil, the profile's owner on a profile.
  use_signed_in_home: false,
  // The one switch for following people, off for everyone until it is released (admins + 30%
  // first). Off hides the Seguir button on profiles and on a table's GM row (the action refuses),
  // "Seguindo" in Editar perfil (its page answers 404) and the owner's follower count. Targeted by
  // the signed-in person's id.
  use_follows: false,
  // The one switch for reminding quem mestra to close a session (on for everyone in GrowthBook). On,
  // a GM whose table still awaits confirmation is e-mailed an hour after the session ended and a
  // week after, and ten days after it (at least three after the last e-mail) the session is settled
  // for them: a one-shot is concluded, a campaign or adventure counts it as held and moves to its
  // next weekly date. Either way the players are asked to rate it, in the bell and by e-mail. Off,
  // the table waits as before. Read by the sweeper, targeted by the GM's id (`isAdmin` too).
  use_session_close_reminders: false,
  // The one switch for blocking and reporting in Mensagens, off for everyone until it is released
  // (then on for everyone). Off hides Bloquear and Denunciar in a conversation and "Pessoas
  // bloqueadas" in Editar perfil, and their actions refuse. Blocks already made keep working either
  // way (the inbox, direct messages, invitations and follows read them). Targeted by the signed-in
  // person's id.
  use_message_safety: false,
  // The game systems directory, off until it is released (a new feature: on for everyone at once,
  // visitors included). Off: /systems and /s/:slug answer 404, the menus and the footer leave
  // Sistemas out and system names stay plain text. Targeted by the person's id.
  api_directory_systems: false,
  // Quem mestra, the directory of people who run games, off until it is released (then on for
  // everyone at once). Off: the "Na mesa, você…" field in Editar perfil, the role tag on the public
  // profile and the note to people the backfill listed are hidden, and a save keeps what is stored.
  // Targeted by the person's id.
  api_directory_gms: false,
  // Onde jogar, the directory of places to play in person, off until it is released (then on for
  // everyone at once). Off: /places and /pp/:slug answer 404, the menus, the footer and the table
  // form leave places out and a table page hides its place. The admin screens stay open to admins,
  // so places can be sent and approved before the release. Targeted by the person's id.
  api_directory_places: false,
  // The place tags catalog (Trello "Diretórios conectados" 1), a new feature (created on for
  // everyone). Off: the place form offers only the six old Comodidades with no suggestions, Onde
  // jogar filters by those six and a place page shows them as "Comodidades". On: the form picks from
  // the whole catalog and suggests new tags (shown once an admin approves them), the page shows one
  // "Tags" section and the list filters by any tag. Either way the tags are stored the same.
  // Targeted by the person's id.
  use_place_tags: false,
  // Linking the directories (Trello "Diretórios conectados" 2 and 3), a new feature (created on for
  // everyone). Off: a partner has no page of its own (/p/:id answers 404) and its card on
  // /partners links nowhere. Targeted by the person's id.
  use_directory_links: false,
  // The lista de espera on full tables, a new feature (created on for everyone). Off: a full table
  // offers nothing, its page shows no line and the GM's page no list, and the actions refuse. Lines
  // already joined still move up when a seat frees. Targeted by the person's id.
  use_waitlist: false,
  // Safety tools and the content rating on tables, a new feature (created on for everyone). Off:
  // the table form leaves both out (a save keeps what is stored), a table page does not show them
  // and the list shows 18+ tables like any other. Targeted by the person's id.
  use_table_safety: false,
  // "Começa já" on /tables, a new feature (created on for everyone): the tables of the list that
  // start within six hours and still have a seat, in a row of their own. Off: no row. Targeted by
  // the person's id.
  use_starting_soon: false,
  // Procuro mesa (`/players`), a new feature (created on for everyone): people say they are looking
  // for a table and GMs find them. Off: the page is a 404, the menus leave it out and the switch
  // refuses. Signed-in people only. Targeted by the person's id.
  use_players_directory: false,
  // The westmarch (open table) kind, a new feature (created on for everyone): a roster larger than
  // any one session. Off: the form does not offer it and refuses it; tables that are one stay as
  // they are. Targeted by the person's id.
  use_open_tables: false,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flagDefaults;

/**
 * Flags that take the site away rather than show hidden work. The local preview mode, which turns
 * every flag on, leaves these off: it should never lock the developer out.
 */
export const killSwitches: ReadonlySet<FlagName> = new Set(['maintenance_mode']);

export const isFlagName = (name: string): name is FlagName => Object.hasOwn(flagDefaults, name);
