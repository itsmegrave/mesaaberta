# @mesaaberta/api

The api app of Trello #120: a Hono app that will own writes, policies and the outbox, one route at a
time, behind `api_<area>` GrowthBook flags (strangler; the web app stays the default path).

**Status: deployed, reached only through the Service Binding.** It answers `/healthz`, the admin
event actions (`POST /v1/admin/events/:id/force`, `POST /v1/admin/events/retry-failed`) and the
admin catalog decisions (`POST /v1/admin/catalog/:decision`, with `approve`, `reject`, `disable`,
`rename`, `merge` and `create`; the body is the form's own schema) and the admin moderation
decisions (`POST /v1/admin/moderation/:decision`, named as in core's `moderationDecisions`, such as
`partner.approve`, `report.ban` or `table.close`), and the first player-facing writes
(`POST /v1/tables/:slug/:action` with `join`, `leave`, `approve`, `decline` and `remove`, named as in
core's `registrationActions`; any signed-in player, authorized by the service, not only admins;
refusals come back as the form's codes:
`table_full`, `already_registered`, `rate_limited`...), and the GM's manage-page answers
(`POST /v1/manage/:slug/:action` with `publish`, `happened`, `notHeld` and `postpone`, behind
`api_table_lifecycle`), and the person's own profile (`POST /v1/account/:action` with `save` and
`messages`, `onboard` (finishing the profile after sign-up), `avatar` (a picture the web Worker stored; answers the file it replaced) and `delete`
(closes the account); the subject is always the actor). The GM's table record
(`POST /v1/table-writes` to create, `/:slug/update`, `/:slug/disable`; web
still validates the form, stores the image and resolves the CEP, and sends the result). The inbox (`POST /v1/inbox/:action` with
`send`, `mute`, `open`, `read` and `readAll`). What a member submits
(`POST /v1/submissions/partners`, `/partners/:id` and `/crowdfundings`; web
still validates the form and stores the picture). The admin's hand actions on an installed extension (`POST /v1/admin/:extension/:action`, from its
`adminActions`, behind the flag `api_admin_<extension>` that the extension declares; none is installed in this repository, and the private Instagram connector's `queue` and `reconcile` use `api_admin_instagram`). The admin
announcements console (`POST /v1/admin/announcements`: count the audience, then send) and the direct conversation with someone (`POST /v1/inbox/direct`). Reporting a table, a partner or a campaign and withdrawing
one's own partner (`POST /v1/reports/:action` with `table`, `partner`, `crowdfunding` and
`withdrawPartner`). The anonymous auth forms, one at a time (`POST /v1/auth/password-reset` e-mails the reset link, with the same per-network limit; the web Worker sends the visitor's address in `x-client-ip` and no `x-actor-id`). Sign-in is the first form with a session hand-off (`POST /v1/auth/sign-in`): the api checks the limit, the password and the profile, then answers `{ result, session: { accessToken, refreshToken } }`, the JWT pair Supabase issued; the web Worker sets it as the cookie session with `setSession` (Supabase verifies it again) and shows `failed` if the call or the session fails (no web fallback). The tokens are never logged. `POST /v1/auth/sign-up` does the same for sign-up: the JWT pair comes back only when no confirmation e-mail is needed, and a session web cannot set sends the person to /login. `POST /v1/auth/new-password` does the new password after the e-mailed link: the web Worker forwards the person's own access token in `Authorization`, the api sets the password through Supabase Auth with it and signs the other sessions out. That finishes the auth forms; logout stays in web. `POST /v1/auth/finish-login` is the database half of a provider sign-in: web trades the OAuth code for the session and forwards the new access token, Supabase vouches for it, and the api ensures the profile, refuses a banned account, records the connection and answers where to go (`ok` with `target`, or `suspended` / `profile_failed`, on which web signs the person out). The Instagram OAuth callback saves the connected account through `POST /v1/admin/instagram/connect` (behind `api_admin_instagram`): web trades the code and encrypts the token, so only the encrypted token reaches the api. Linking and unlinking a provider stay in web: they are Supabase Auth calls with no database write, and linking keeps its PKCE verifier in a web cookie. Rating a table's GM after the first session (`POST /v1/tables/:slug/rate`, in the registrations route; refusals `too_early`, `already_rated`, `forbidden`). Adding a password to an account that signed in
with a provider (`POST /v1/account/password/code` e-mails a six-digit code, `POST
/v1/account/password` checks it and sets the password); the web Worker
forwards the person's own access token in `Authorization`, so the password is set as them and no
Auth secret key lives here. This one needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and the mail
settings (`RESEND_API_KEY`, `RESEND_FROM`) on the api Worker, and has no web fallback. The page readers live here, with no flag and no web fallback (web answers the api's `not_found` as its 404, `forbidden`/`table_concluded` as its 403, and anything else as a 503): `GET /v1/reads/catalog` answers the systems, platforms and tags the new-table and edit forms offer, as the person named in `x-actor-id` (their own pending suggestions included); `GET /v1/reads/preview` the home page's next tables, `GET /v1/reads/tables` the `/tables` list for the validated filters and `GET /v1/reads/detail/:slug` a table's page (an unknown table or someone else's draft is a 404), all three for visitors too (no actor header, or an account with no profile yet, reads as a visitor); `GET /v1/reads/dashboard?page=N` the signed-in person's own Minhas mesas page (a page past the last is a 404); `GET /v1/reads/manage/:slug` the GM's table page; `GET /v1/reads/edit-catalog/:slug` the same lists merged with a table's own picks for its GM (`?tz=` is the zone web resolved); and `GET /v1/admin-reads/{overview,users,tables}` the admin pages' data for an admin (list filters travel as the query string, pictures stay paths, and `tables` adds `instagramExpiresAt`). `GET /v1/profiles/:username?page=N` answers the public profile page (`/u/[username]`) for visitors and signed-in people (the actor header, when present, only decides the owner's view and the follow part): every flag-gated part is read and web asks the flags, targeted by the `subject` it answers, and drops what is off; an unknown or inactive person or a page past the last is a 404. No flag and no web fallback: database reads live in the api now, and web answers 503 when it fails. `GET /v1/seo/sitemap` (page counts) and `GET /v1/seo/sitemap/:resource?page=N` (`tables` or `profiles`, 500 slugs a page; a bad or past-the-end page is a 404) feed `/sitemap.xml`: a new anonymous read with no flag and no web fallback, so web answers an uncached 503 when it fails and the api must ship with or before web. It has no public route and no cron. The web Worker reaches it through a Service Binding (`API`), sending the signed-in admin's id
in `x-actor-id`; the api checks that person is an active admin in the database again. The writes
have no web fallback and no flag: web calls the api and answers 503 when the call fails. A
decision the api refuses (HTTP 400 `invalid`) is shown on the form. The api Worker needs the same database binding and
secrets as the other Workers, set by the private deployment.

## Moving a route (the rule)

1. Put the domain logic in `@mesaaberta/core` (runtime-neutral, no SvelteKit imports).
2. Add the Hono route here; keep the web form action as the default path.
3. Behind `api_<area>` (default off), the form action calls the api instead; admins first.
4. Roll back by turning the flag off.

Run `bun run --bun vitest run --project server apps/api`.

## Self-hosting (Bun / Docker)

`src/entry/bun.ts` serves the same app with `Bun.serve`, and `Dockerfile` builds it from the
repository root: `docker build -f apps/api/Dockerfile -t mesaaberta-api .`. Over HTTP the
`x-actor-id` header is only a claim, so every `/v1` request must carry the shared secret in
`x-internal-token` and the process refuses to start without `API_INTERNAL_TOKEN`. Keep the port on a
private network behind the web app (the web app calls it with `API_URL` + `API_INTERNAL_TOKEN`);
never publish it. It needs `DATABASE_URL` and the same Auth and mail settings as the Worker.

## Table duplication

New table-duplication endpoints are API-owned and do not use the legacy migration flags:

- `GET /v1/tables/:slug/duplication`: private defaults from a table owned by the actor, with an empty required game date.
- `POST /v1/tables/:slug/duplicate`: create a separate empty table at a non-overlapping time, with an optional submission UUID for idempotency.

The web app requires its API Service Binding, or the existing private `API_URL` / `API_INTERNAL_TOKEN` transport. It returns a service error when that transport is unavailable; it does not duplicate records locally. The Playwright setup starts a private local API alongside the web app. `E2E_DB_URL` can point both services at an isolated migrated test database.

## Player invitations

New invitation routes are API-owned, without a migration flag or web database fallback:

- `GET /v1/account/invitations`, `GET /v1/invitations/:id`: the actor's private received invitations and consent page data.
- `GET /v1/tables/:slug/invitations`: a GM's sent invitations; `GET /v1/tables/:slug/my-invitation`: the actor's own pending invitation.
- `POST /v1/tables/:slug/invitations`: reserve a seat and invite an existing player.
- `POST /v1/invitations/:id/accept`, `/decline`, `/cancel`: authenticated explicit decisions; GET never changes membership.
- `GET|POST /v1/account/invitation-preferences`, `POST /v1/account/invitation-blocks`: receiving preferences and GM-specific blocking.

New calls require the API Service Binding or private `API_URL` / `API_INTERNAL_TOKEN` transport. Pending reservations expire after 48 hours or at the session start, whichever occurs first. The worker materializes expirations; capacity queries honor the deadline without waiting for it. The new optional hosted e-mail template is `RESEND_TEMPLATE_PLAYER_INVITATION`; its plain-text fallback is available without template configuration. The existing template script provisions it when explicitly run for a deployment.

## Mensagens

The inbox and threads are API-owned, without a flag or web database fallback (web answers the api's `not_found` as its 404 and anything else it cannot use as a 503):

- `GET /v1/messages/inbox?page=N&kind=direct|table`: the actor's conversations (a page past the last is a 404).
- `GET /v1/messages/:id?before=ISO`: a page of a conversation's messages, for a member.
- `POST /v1/messages/:id/open` (`{ about }`, the table slug a direct message starts from): the thread page's header and newest messages; opening it reads it.
- `POST /v1/messages/:id/read`: everything in the conversation is read now.
- `POST /v1/messages/tables/:slug`: a table's chat for its GM and confirmed players, made on first use.
- `POST /v1/messages/tables/:slug/gm`: "Falar com quem mestra", the direct conversation with an active table's GM (`{ conversationId, slug }`).
- `GET /v1/messages/blocked`, `POST /v1/messages/block`, `POST /v1/messages/:id/report`: blocking and reporting; web checks `use_message_safety` before it calls these.

Pictures stay paths: the web Worker turns them into URLs.

## The signed-in person's frame

`/v1/me` is API-owned, without a flag or web database fallback:

- `GET /v1/me`: the actor's whole profile row (`{ profile }`, null when the account has no profile yet). The web Worker's `locals.getProfile()` reads it once per request, so every policy check uses the api's copy.
- `GET /v1/me/shell`: the header on every page (the bell's number and latest few, the conversations with something unread, and for an admin the catalog suggestions waiting).
- `GET /v1/me/badges`: the two numbers the page polls.
- `GET /v1/me/notifications?page=N&category=&unread=1`: a page of the feed and the unread total (a page past the last is a 404).

`achievements=1` says the badge notices are on for the person (`use_badges`, decided in web).

## Seguir

`/v1/follows` is API-owned, without a flag or web database fallback; web checks `use_follows` before it calls these:

- `GET /v1/follows/:profileId` and `POST /v1/follows/:profileId` (`{ follow }`): whether the actor follows someone, and following (records `FollowStarted` the first time) or stopping.
- `GET /v1/follows/gm/:slug`: the Seguir button on a table's GM row, for visitors too (`{ profileId, following }`; a table the viewer cannot see is a 404). The table read keeps the GM's id out.
- `GET /v1/follows?page=N` ("Seguindo" and the follower count) and `POST /v1/follows/notices` (its bell switches).

## Table forms

The new-table and edit forms read no database in web either:

- `GET /v1/reads/table-edit/:slug?tz=`: a table as its edit form shows it, times in the zone web resolved (403 for someone else's table, with `table_concluded` for a concluded one; 404 when it is not there).
- `GET /v1/reads/place-options`: the "Onde jogar" picker's listed places.
- `POST /v1/reads/table-location` (`{ input, placeSlug }`): where a table being saved happens; the picked place (web sends it only while the places are on) brings its CEP and area, otherwise the typed CEP is looked up. Answers the input to save, or the refusal on its field.
- `GET /v1/me/limits/:name` (`table`, `draft`, `crowdfunding`, `place`, `placeClaim`): whether the actor is under a limit now (`{ ok: true }` or `rate_limited` with `retryAfter`), so a form can say so before it stores an image. The write checks again.

## Profile setup and edit

The onboarding step and the profile editor read no database in web:

- `POST /v1/auth/ensure-profile`: with the person's own access token in `Authorization: Bearer`, checked by Supabase, makes sure they have a profile (made from their sign-in metadata on first use) and answers `{ result: 'ok', profile }`. No token or a refused one is `no_session` (401).
- `GET /v1/me/profile-form`: the actor's profile as its form shows it.
- `GET /v1/me/username-available?username=`: whether a username is free for the actor (their own counts as free).
- `GET /v1/me/has-password`: whether the e-mail and password way in is on.
- `GET /v1/me/export?email=`: the data portability copy; web passes the e-mail from Auth.
- `GET /v1/me/favorite-systems` and `POST /v1/me/favorite-systems` (`{ systems, show }`): every system and the actor's favorites; the write records `FavoriteSystemsChanged`.

## Profile page and calendar

- `POST /v1/messages/users/:username`: "Mandar mensagem" on a profile; the direct conversation with that person, made when there is none (404 for an unknown username).
- `POST /v1/me/badges/:badgeId/hidden` (`{ hidden }`): the eye on an earned badge (404 for a badge the actor does not hold).
- `GET /v1/me/calendar`: the tables the actor runs or has a seat at; web writes the `.ics`.

## Início and the directories

Each page past the last is a 404; web checks the directory flags first.

- `GET /v1/reads/systems?…`, `GET /v1/reads/systems/:slug`: the systems list for the address's filters, and one system's page (a merged one answers `{ redirectTo }`).
- `GET /v1/reads/gamemasters?…&badges=1`: Quem mestra, with the systems its filter offers; `badges=1` while `use_badges` is on for the viewer.
- `GET /v1/reads/places?…`, `GET /v1/reads/places/:slug`: Onde jogar, and one place's page (a pending or hidden place only for whoever sent it, owns it or moderates).
- `GET /v1/reads/home?follows=1`: the signed-in Início; `follows=1` while following is on for the actor.

Web turns the dates back with `revivedDates` (`api-read.ts`).

## Parceiros

`/v1/partners` (`partners.ts`); the services authorize, and web checks `use_partner_owners` before the owner routes it gates:

- `GET /v1/partners?…`: one page of the list for visitors too, each card with its `ownerIds` (web turns them into `canEdit` and `canReport` and never sends them to the browser). Past the last page is a 404.
- `GET /v1/partners/:id/edit?owners=1`: a partner the actor looks after, with "Quem cuida do parceiro" when asked (403/404 otherwise; web shows both as its 404).
- `POST /v1/partners/:id/owners/{invite,cancel,remove,leave}` (`{ username }`, `{ invitationId }`, `{ profileId }`, nothing).
- `GET /v1/partners/invitations/:id`, `POST /v1/partners/invitations/:id/{accept,decline}`: the invite, for the invited person only.

## Admin pages

The admin pages read no database in web; each route is behind the admin guard, takes the page's filters as the query string, and answers a 404 past the last page:

- `GET /v1/admin-reads/counts`: what waits beside each section (`adminCounts`, now in core).
- `GET /v1/admin-reads/{badges,audit,reports,places,claims,crowdfundings,partners}` and `GET /v1/admin-reads/reports/:id`.
- `GET /v1/admin-reads/catalog?kind=&q=&status=&page=&size=&sort=` (the console, with the approved entries of that kind) and `GET /v1/admin-reads/queue` (suggestions waiting, recent decisions, the approved catalog).
- `GET /v1/admin-reads/announcements` (audience sizes and history) and `GET /v1/admin-reads/recipients?q=` (usernames).
- `GET /v1/admin-reads/users/:id?badges=1` and `GET /v1/admin-reads/tables/:id` (one person or table, with history; badges only while `use_badges` is on for the admin).
- `GET /v1/admin/events?…`: the event queue page (`eventFilters` moved to core).

The extension panels (`/admin/[ext]`) still run in web until the api can read the extensions' flags.

## Onde jogar forms

`/v1/places` (`places.ts`); web checks `api_directory_places`, validates the form and stores the photo, and the services authorize:

- `POST /v1/places` (`{ input, imagePath }`) and `POST /v1/places/:slug` (an edit): answer `{ eventIds, slug }` (and `replacedImage` on an edit). A duplicate is `invalid` on `name` with `place_duplicate` and the listed place's `slug`.
- `GET /v1/places/:slug/edit`: the place the actor may edit (403/404 otherwise; web shows both as its 404).
- `GET /v1/places/:slug/claim` and `POST /v1/places/:slug/claim`: "Este lugar é seu?" for a listed place.

## Financiamentos

`/v1/crowdfundings` (`crowdfundings.ts`); adding a campaign stays `POST /v1/submissions/crowdfundings`:

- `GET /v1/crowdfundings?…`: the list for visitors too, each campaign with its `submitterId` (web turns it into `canReport` and never sends it to the browser).
- `GET /v1/crowdfundings/listed?url=`: whether a campaign at that link is listed already.
- `POST /v1/crowdfundings/link-read`: counts one read of a campaign page against `LINK_READ_LIMIT` (`rate_limited` past it), for the link preview and the add form's own read.
