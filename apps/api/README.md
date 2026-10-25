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
core's `registrationActions`; any signed-in player, authorized by the service, not only admins, so
`api_registrations` is evaluated with the player's id and refusals come back as the form's codes:
`table_full`, `already_registered`, `rate_limited`...), and the GM's manage-page answers
(`POST /v1/manage/:slug/:action` with `publish`, `happened`, `notHeld` and `postpone`, behind
`api_table_lifecycle`), and the person's own profile (`POST /v1/account/:action` with `save` and
`messages`, `onboard` (finishing the profile after sign-up), `avatar` (a picture the web Worker stored; answers the file it replaced) and `delete`
(closes the account), behind `api_account`; the subject is always the actor). The GM's table record
(`POST /v1/table-writes` to create, `/:slug/update`, `/:slug/disable`, behind `api_table_write`; web
still validates the form, stores the image and resolves the CEP, and sends the result). The inbox (`POST /v1/inbox/:action` with
`send`, `mute`, `open`, `read` and `readAll`, behind `api_inbox`). What a member submits
(`POST /v1/submissions/partners`, `/partners/:id` and `/crowdfundings`, behind `api_submissions`; web
still validates the form and stores the picture). The admin's hand actions on an installed extension (`POST /v1/admin/:extension/:action`, from its
`adminActions`: Instagram's `queue` and `reconcile` today, behind `api_admin_instagram`; the render and the publish stay in the background). The admin
announcements console (`POST /v1/admin/announcements`: count the audience, then send,
behind `api_admin_announcements`) and the direct conversation with someone (`POST /v1/inbox/direct`,
behind `api_inbox`). Reporting a table, a partner or a campaign and withdrawing
one's own partner (`POST /v1/reports/:action` with `table`, `partner`, `crowdfunding` and
`withdrawPartner`, behind `api_reports`). The anonymous auth forms, one at a time (`POST /v1/auth/password-reset` e-mails the reset link, with the same per-network limit; the web Worker sends the visitor's address in `x-client-ip` and no `x-actor-id`; behind `api_auth`, all or nothing since nobody is signed in). Sign-in is the first form with a session hand-off (`POST /v1/auth/sign-in`, behind `api_auth_sign_in`, targeted by a hash of the visitor's network): the api checks the limit, the password and the profile, then answers `{ result, session: { accessToken, refreshToken } }`, the JWT pair Supabase issued; the web Worker sets it as the cookie session with `setSession` (Supabase verifies it again) and falls back to its own sign-in if the call or the session fails. The tokens are never logged. `POST /v1/auth/sign-up` does the same for sign-up (behind `api_auth_sign_up`): the JWT pair comes back only when no confirmation e-mail is needed, and a session web cannot set sends the person to /login. `POST /v1/auth/new-password` does the new password after the e-mailed link (behind `api_auth_new_password`, targeted by user id): the web Worker forwards the person's own access token in `Authorization`, the api sets the password through Supabase Auth with it and signs the other sessions out. That finishes the auth forms; logout stays in web. `POST /v1/auth/finish-login` is the database half of a provider sign-in (behind `api_auth_finish_login`, hashed network): web trades the OAuth code for the session and forwards the new access token, Supabase vouches for it, and the api ensures the profile, refuses a banned account, records the connection and answers where to go (`ok` with `target`, or `suspended` / `profile_failed`, on which web signs the person out). The Instagram OAuth callback saves the connected account through `POST /v1/admin/instagram/connect` (behind `api_admin_instagram`): web trades the code and encrypts the token, so only the encrypted token reaches the api. Linking and unlinking a provider stay in web: they are Supabase Auth calls with no database write, and linking keeps its PKCE verifier in a web cookie. Rating a table's GM after the first session (`POST /v1/tables/:slug/rate`, in the registrations route, behind `api_ratings`; refusals `too_early`, `already_rated`, `forbidden`). Adding a password to an account that signed in
with a provider (`POST /v1/account/password/code` e-mails a six-digit code, `POST
/v1/account/password` checks it and sets the password), behind `api_password`; the web Worker
forwards the person's own access token in `Authorization`, so the password is set as them and no
Auth secret key lives here. This one needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and the mail
settings (`RESEND_API_KEY`, `RESEND_FROM`) on the api Worker, and has no web fallback. The read side starts here: `GET /v1/reads/catalog` answers the systems, platforms and tags the new-table and edit forms offer, as the person named in `x-actor-id` (their own pending suggestions included), behind `api_reads_catalog`, and `GET /v1/reads/preview` the home page's next three tables for a signed-in person (behind `api_reads_preview`; visitors read in web, and web turns the picture path into a URL), and `GET /v1/reads/tables` the `/tables` list for the validated filters (behind `api_reads_tables`, signed-in people only), and `GET /v1/reads/dashboard?page=N` the signed-in person's own Minhas mesas page (behind `api_reads_dashboard`; a page past the last is a 404 and web answers its own), and `GET /v1/reads/manage/:slug` the GM's table page (behind `api_reads_manage`; `forbidden`/`not_found` refusals make web answer its own 403/404), and `GET /v1/admin-reads/{overview,users,tables}` the admin pages' data for an admin (behind `api_reads_admin`, `api_reads_admin_users`, `api_reads_admin_tables`; list filters travel as the query string and pictures stay paths), and `GET /v1/reads/detail/:slug` the table page for the signed-in person (behind `api_reads_detail`; an unknown table or someone else's draft is a 404 and web answers its own; visitors read in web), and `GET /v1/reads/edit-catalog/:slug` the same lists merged with a table's own picks for its GM (`?tz=` is the zone web resolved; refusals come back as `forbidden`/`table_concluded`/`not_found`), behind `api_reads_edit_catalog`; web keeps its in-process reader as the fallback. It has no public route and no cron. The web Worker reaches it through a Service Binding (`API`), sending the signed-in admin's id
in `x-actor-id`; the api checks that person is an active admin in the database again. On web the
actions only call it when `api_admin_events` (`api_admin_catalog` for the catalog, `api_admin_moderation` for moderation) is on for the
admin and the binding exists, and fall back to the in-process path when the call fails. A catalog
decision the api refuses (HTTP 400 `invalid`) is shown on the form and not retried in-process. The api Worker needs the same database binding and
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
