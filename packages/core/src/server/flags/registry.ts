/**
 * Every feature flag the app knows about, with the value used when GrowthBook cannot answer
 * (unreachable, slow, or the flag not created yet). Defaults keep unfinished work hidden, so
 * new flags default to `false`. Create a feature with the same key in GrowthBook.
 */
export const flagDefaults = {
  // Off: the site as usual. On: every visitor gets the maintenance screen; admins still get through.
  maintenance_mode: false,
  // Off: text and QR artwork. On: include the table photo as its background.
  use_table_image: false,
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
  // Off: the admin event actions ("Rodar agora", "Rodar todos os que falharam") run in the web
  // Worker. On: they call the api Worker over the Service Binding and fall back to the web path when
  // the api cannot be reached. Needs the API binding; without it this flag does nothing.
  api_admin_events: false,
  // Off: the catalog console's decisions (approve, reject, disable, rename, merge, create) run in
  // the web Worker. On: the api Worker makes them over the Service Binding, and the web Worker
  // dispatches the event as before; a call that cannot be made falls back to the web path. Needs
  // the API binding. Target admins first.
  api_admin_catalog: false,
  // Off: the admin moderation decisions (review, accept or dismiss a report, close a table, take a
  // campaign or partner down, ban or revoke a ban, approve a partner) run in the web Worker. On:
  // the api Worker makes them over the Service Binding, from the same decision registry, and the
  // web Worker dispatches the events it returns; a call that cannot be made falls back to the web
  // path. Needs the API binding. Target admins first.
  api_admin_moderation: false,
  // Off: joining, leaving and the GM's approve, decline and remove run in the web Worker. On: the
  // api Worker makes them over the Service Binding, from the same action registry, answering the
  // events the web Worker dispatches; the refusals (full table, rate limit...) come back as the
  // codes the form already shows, and a call that cannot be made falls back to the web path. Needs
  // the API binding. The first player-facing flag: target a few ids before everyone.
  api_registrations: false,
  // Off: the GM's manage-page answers (publish a draft, the session happened or did not, postpone)
  // run in the web Worker. On: the api Worker makes them over the Service Binding, from the same
  // action registry; refusals come back as the codes the form shows and a call that cannot be made
  // falls back to the web path. Needs the API binding. Target a few ids first.
  api_table_lifecycle: false,
  // Off: saving the profile form and the direct-messages switch run in the web Worker. On: the api
  // Worker makes them over the Service Binding, from the same action registry, as the signed-in
  // person; refusals (a taken username) come back as the codes the form shows and a call that
  // cannot be made falls back to the web path. Needs the API binding. Admins first.
  api_account: false,
  // Off: creating, editing and disabling a table run in the web Worker. On: the web Worker still
  // validates the form, stores the image and resolves the CEP, then the api Worker writes the table
  // over the Service Binding from the same services; refusals come back as the codes the form shows
  // and a call that cannot be made falls back to the web path. Needs the API binding. Admins first.
  api_table_write: false,
  // Off: sending and muting in a conversation, and opening and reading notifications, run in the
  // web Worker. On: the api Worker makes them over the Service Binding from the same action
  // registry; refusals (rate limit, direct messages off) come back as the codes the form shows and a
  // call that cannot be made falls back to the web path. Needs the API binding. Admins first.
  api_inbox: false,
  // Off: the new-table and edit forms read the catalog of systems, platforms and tags in the web
  // Worker. On: the api Worker answers it over the Service Binding from the same reader, as the
  // signed-in person (their own pending suggestions included); a call that cannot be made falls
  // back to the web path. Needs the API binding. Admins first.
  api_reads_catalog: false,
  // Off: a table's edit form reads its systems, platforms and tags in the web Worker. On: the api
  // Worker answers it over the Service Binding from the same reader, as the signed-in person; a
  // refusal or a call that cannot be made falls back to the web path, which raises the page's error.
  api_reads_edit_catalog: false,
  // Off: the home page's preview of the next tables is read in the web Worker. On: for a signed-in
  // person the api Worker answers it over the Service Binding from the same reader (the picture
  // path becomes a URL in web, which owns the Supabase setting); visitors always read here, and a
  // call that cannot be made falls back to the web path. Needs the API binding. Admins first.
  api_reads_preview: false,
  // Off: the /tables list and its filters are read in the web Worker. On: for a signed-in person
  // the api Worker answers it over the Service Binding from the same reader, given the validated
  // filters; visitors always read here, and a call that cannot be made falls back to the web
  // path. Needs the API binding. Admins first.
  api_reads_tables: false,
  // Off: the table page (/tables/:slug) is read in the web Worker. On: for a signed-in person the api
  // Worker answers it over the Service Binding from the same reader; visitors always read here, and
  // a call that cannot be made, or a refusal, falls back to the web path. Needs the API binding.
  // Admins first.
  api_reads_detail: false,
  // Off: Minhas mesas (/account/tables) is read in the web Worker. On: for the signed-in person the
  // api Worker answers it over the Service Binding from the same reader, given the page number; a
  // call that cannot be made, or a refusal, falls back to the web path. Needs the API binding.
  // Admins first.
  api_reads_dashboard: false,
  // Off: the GM's table page (/tables/:slug/manage) is read in the web Worker. On: for the signed-in
  // person the api Worker answers it over the Service Binding from the same reader; a refusal or a
  // call that cannot be made falls back to the web path, which answers the page's own 403/404.
  // Needs the API binding. Admins first.
  api_reads_manage: false,
  // Off: sending or editing a partner and adding a crowdfunding campaign run in the web Worker. On:
  // the web Worker still validates the form and stores the picture, then the api Worker saves it
  // over the Service Binding from the same services; refusals come back as the codes the form
  // shows and a call that cannot be made falls back to the web path. Needs the API binding.
  api_submissions: false,
  // Off: the profile page does not offer a password to an account that signed in with a provider.
  // On: it does, and the api Worker does the work over the Service Binding (an e-mailed code, then
  // the password, set with the person's own access token). Unlike the other api flags there is no
  // web path to fall back to: the web Worker sends no mail, so a call that cannot be made shows the
  // form's "try again" message. Needs the API binding and, on the api Worker, the Supabase and mail
  // settings. Target admins first.
  api_password: false,
  // Off: reporting a table, a partner or a campaign and withdrawing one's own partner run in the
  // web Worker. On: the api Worker does them over the Service Binding, from the same action
  // registry; the web Worker still dispatches the events it returns, refusals come back as the codes
  // the dialog shows and a call that cannot be made falls back to the web path. Needs the API
  // binding. Admins first.
  api_reports: false,
  // Off: rating a table's GM after the first session runs in the web Worker. On: the api Worker does
  // it over the Service Binding, from the same action registry as the registrations; the web Worker
  // still dispatches the event it returns, refusals (`too_early`, `already_rated`, `forbidden`) come
  // back as the codes the form shows and a call that cannot be made falls back to the web path.
  // Needs the API binding. Admins first.
  api_ratings: false,
  // Off: the anonymous auth forms (today the "forgot my password" e-mail) run in the web Worker. On:
  // the api Worker does them over the Service Binding, with the same per-network limit; a call that
  // cannot be made falls back to the web path. Nobody is signed in, so there is no one to target:
  // the flag is all or nothing. Needs the API binding and, on the api Worker, the Supabase settings.
  api_auth: false,
  // Off: the admin announcements console (count the audience, then send) runs in the web Worker. On:
  // the api Worker does it over the Service Binding and the web Worker dispatches the event it
  // returns; a call that cannot be made falls back to the web path. Needs the API binding. Every
  // admin may have it: the flag is a kill switch.
  api_admin_announcements: false,
  // Off: the admin's hand actions on Instagram posts (queue a table, reconcile an uncertain post) run
  // in the web Worker. On: the api Worker does them over the Service Binding; the render and the
  // publish stay in the background after the web response. A call that cannot be made falls back to
  // the web path. Needs the API binding. Every admin may have it: the flag is a kill switch.
  api_admin_instagram: false,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flagDefaults;

/**
 * Flags that take the site away rather than show hidden work. The local preview mode, which turns
 * every flag on, leaves these off: it should never lock the developer out.
 */
export const killSwitches: ReadonlySet<FlagName> = new Set(['maintenance_mode']);

export const isFlagName = (name: string): name is FlagName => Object.hasOwn(flagDefaults, name);
