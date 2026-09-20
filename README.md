# Mesa Aberta

A scheduler for tabletop RPG tables: game masters open tables, players sign up, everyone gets a calendar invite. Planned home: mesaaberta.app (deployment is tracked in [#3](https://github.com/itsmegrave/mesaaberta/issues/3)).

The roadmap and architecture decisions live in [issue #1](https://github.com/itsmegrave/mesaaberta/issues/1).

## Stack

SvelteKit (Svelte 5, TypeScript) · Tailwind CSS · Paraglide (i18n) · Vitest · Playwright · pnpm · Node 26

## Getting started

Requirements: Node and pnpm at the versions in `.tool-versions` and `packageManager` in `package.json`.

```sh
pnpm install
pnpm exec playwright install chromium   # component and e2e tests run in a real browser
pnpm dev
```

## Scripts

| Script           | What it does                                                                      |
| ---------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`       | Dev server                                                                        |
| `pnpm build`     | Production build                                                                  |
| `pnpm lint`      | Prettier check and ESLint                                                         |
| `pnpm format`    | Prettier write                                                                    |
| `pnpm i18n`      | Compile `messages/*.json` into `src/lib/paraglide` (run by `prepare` and `check`) |
| `pnpm check`     | Type-check `.ts` and `.svelte` files                                              |
| `pnpm test:unit` | Vitest: component tests (Chromium) and unit tests (Node)                          |
| `pnpm test:e2e`  | Playwright against a production build, on mobile and desktop                      |
| `pnpm test`      | Unit tests, then e2e                                                              |

## Project layout

```
src/routes/   pages and layouts
src/lib/      shared code, imported through $lib
e2e/          Playwright tests (*.e2e.ts)
```

Component tests sit next to the code as `*.svelte.spec.ts`; plain unit tests as `*.spec.ts`.

## Feature flags

Flags come from [GrowthBook](https://www.growthbook.io). To add one:

1. Add it to `flagDefaults` in `src/lib/server/flags/registry.ts` with a safe default (`false` hides unfinished work). That value is used whenever GrowthBook cannot answer.
2. Create a feature with the same key in GrowthBook.
3. Read it in server code: `await locals.flags.isEnabled('my_flag', { id: user.id, role: user.role })`.

Flags load lazily, only when something reads one, and the payload is cached for 60 seconds. The GrowthBook client key in `wrangler.jsonc` is public by design: it can only read flags. Without those settings, for example under plain `vite dev`, every flag returns its default.

In GrowthBook, create one SDK connection for each environment (production and preview), then publish
the feature configuration after changing a value or rule. Put only its client key in the corresponding
Cloudflare environment settings. Client keys let an app retrieve the published feature payload; they are
not admin credentials, so they may be committed. Do not put a GrowthBook API key in the repository.
Feature evaluation happens in the Worker, so its targeting data and payload never reach the browser; an
encrypted SDK endpoint is not needed for this integration.

## Database

Postgres through [Drizzle ORM](https://orm.drizzle.team) and `postgres.js`. Supabase provides Postgres, Auth and Storage; app data goes through Drizzle from server code, never from the browser. The schema lives in `src/lib/server/db/schema.ts` and the SQL migrations in `drizzle/` (commit them).

**Run it locally** (needs Docker):

```sh
cp .dev.vars.example .dev.vars   # DATABASE_URL for the local database
pnpm db:up                       # Postgres in Docker, waits until it is healthy
pnpm db:migrate                  # apply the migrations
pnpm db:seed                     # optional: a GM and two tables
pnpm dev
```

`pnpm db:down` stops it. After changing the schema, run `pnpm db:generate`, read the SQL it wrote, and commit it. Tests run the real migrations on an in-process Postgres (PGlite), so `pnpm test` needs no Docker.

**RPG systems.** The 682 systems tables are categorised by (D&D 5e, Tormenta 20, ...) are rows in `systems`, seeded by a migration so every environment has them after `pnpm db:migrate`. Each keeps its name exactly as written and has a unique slug for its URL, made by `slugify()` in `src/lib/slug.ts`; `position` keeps the source order (most played first, then A to Z). `game_tables.system_id` points at a system. Read them with `listSystems(db)` and `findSystemBySlug(db, slug)` from `$lib/server/systems`, and never keep a second list of systems. Slugs never change once shipped, because URLs and invites use them. To add a system, write a new migration with an `INSERT ... ON CONFLICT ("slug") DO NOTHING`.

**Browsing tables.** `/tables` lists active tables that still have a session ahead (soonest first, filterable by system) and `/tables/<slug>` shows one; an unknown or disabled slug is the translated 404. The queries are in `src/lib/server/tables/queries.ts` and the next-session logic in `schedule.ts`: a weekly campaign keeps its wall-clock time in its own timezone across daylight-saving changes, and only `FREQ=WEEKLY` (with `INTERVAL`) is understood. The header link "Mesas" appears when the `is_platform_released` flag is on; the pages exist, unlinked, before that. Seats left are every seat until registrations exist (#11). The end-to-end tests for these pages need the seeded database and skip locally when there is none (CI always has one).

**Managing tables.** A signed-in user opens a table at `/tables/new` and becomes its GM; the GM or an admin edits it at `/tables/<slug>/edit` and can disable it. Every write goes through `src/lib/server/tables/write.ts`, which asks the policy first. The form is validated with Zod (`src/lib/tables/schema.ts`); anything the form does not list (`gmId`, `status`, `slug`) is dropped. The slug comes from the title (`mesa` if it has nothing usable), is numbered `-2`, `-3` on a collision, is never `new` or `edit`, retries if two creates race for it, and never changes when the title does. Each edit raises `ical_sequence` so calendar invites replace the old event.

**Table images** are uploaded through the server: 2 MB at most, PNG, JPEG or WebP judged by the file's first bytes (never its name or the type the browser claims), and a random file name. They live in a public Supabase Storage bucket, `table-images`. One-time setup in the Supabase SQL editor:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('table-images', 'table-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "signed-in users can upload table images" on storage.objects
  for insert to authenticated with check (bucket_id = 'table-images');
```

Without it the form still works; only saving with an image fails, with a message on the image field. Replaced images are not deleted yet.

Server code reads the database from `locals.db`, which is `null` when none is configured, so the site still runs without one. `GET /healthz` reports `database: ok | down | not_configured` and answers 503 when a configured database does not respond.

**The deployed Worker** reaches Supabase through Hyperdrive: the `HYPERDRIVE` binding in `wrangler.jsonc` holds the Hyperdrive config id (not a secret). To set it up from scratch:

1. In Supabase, open Connect and copy the **session pooler** connection string (port 5432). Hyperdrive does its own pooling, so do not use the transaction pooler (port 6543).
2. `wrangler hyperdrive create mesaaberta-db --connection-string="<that string>"` prints an id.
3. Put the id in the `hyperdrive` block of `wrangler.jsonc`.
4. Run the migrations against Supabase once: `DATABASE_URL="<direct or session string>" pnpm db:migrate`.
5. Deploy, then check `/healthz` shows `"database": "ok"`.

**Locally**, the binding's `localConnectionString` points at the Docker Postgres, so `pnpm dev`, `wrangler dev` and the e2e tests use it without `.dev.vars`: run `pnpm db:up && pnpm db:migrate` first. With the binding in place and no database running, `/healthz` reports `down` (503) rather than `not_configured`. The `db:*` scripts still read `DATABASE_URL` from `.dev.vars`.

Limits checked on 2026-09-19: Supabase's free Nano compute allows 60 direct and 200 pooler connections ([compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk)); Hyperdrive on the free plan allows about 20 origin connections per configuration and 10 configurations per account ([limits](https://developers.cloudflare.com/hyperdrive/platform/limits/)). The Worker opens at most 5 connections per request, so both are comfortable for now. Check the pages again before relying on the numbers.

## Sign-in

Sign-in goes through Supabase Auth (Google and Discord) with cookie sessions from `@supabase/ssr` and the PKCE flow. The flow is server-side: `/login/<provider>` starts it, `/auth/callback` finishes it and creates a `member` profile on the first login, and `POST /logout` ends it. Login is off until the Supabase settings exist: the site runs, and the "Entrar" link is hidden.

In server code, ask who is signed in through `locals.getUser()`. It asks Supabase to verify the session token, and never trusts the cookie on its own. To protect a page or an action:

```ts
import { requireUser } from '$lib/server/auth/guard';

export const load = async ({ locals, url }) => {
	const user = await requireUser(locals, url); // anonymous visitors go to /login and come back
	// ...
};
```

**Email and password** (`/signup` and `/login`) is Supabase Auth's own email login: Supabase stores the hashed password, sends the confirmation email and verifies the session. We store nothing and only call it (`src/lib/server/auth/email.ts`), then make sure the person has a profile. Sign-up creates the account and Supabase emails a confirmation link (which comes back to `/auth/callback`); until it is confirmed, sign-in answers "confirm your email". A wrong password and an unknown address get the same message, and a repeat sign-up says the same "check your email" as a first one, so neither can be used to find out who is registered. The email address and the password are never logged. Passwords are 8 to 72 characters (72 is where bcrypt cuts off).

**Password reset** uses Supabase's recovery flow. `/forgot-password` asks for an email and always answers "if the address has an account, we sent a link" (Supabase does not say whether it does, and neither do we). The link comes back through `/auth/callback`, which signs the person in and sends them to `/reset-password`, where they choose a new password (typed twice, 8 to 72 characters). Changing it signs every other session out, in case whoever knew the old password was still in. `/reset-password` is only for someone a recovery link just signed in: without a session it sends them to ask for a new link. Because sign-in uses PKCE, the link only works in the browser that asked for it; opened elsewhere, the login page says to open it in the same browser or ask again. The address and the passwords are never logged. Supabase's Reset Password email template needs no change: it already sends `{{ .ConfirmationURL }}`, which returns to the redirect URLs set for the social providers.

**Supabase settings for email login** (Authentication in the dashboard):

- **SMTP.** Supabase's built-in email sender only delivers to your own team's addresses and is heavily rate limited: real people will not get their confirmation link until you set a custom SMTP under Emails > SMTP Settings (Resend is the plan for #13; its SMTP credentials work here too).
- **Sign In / Providers > Email:** leave "Confirm email" on, and set the minimum password length to 8 to match the form.
- **URL Configuration:** the Site URL and the redirect URLs for `/auth/callback`, as for the social providers.

**Set it up** (one-time, needs your Supabase account and one OAuth app per provider):

1. In the Supabase project, open Authentication > Providers and enable Google and Discord. Each needs an OAuth app at the provider; its callback URL is Supabase's own, `https://<project>.supabase.co/auth/v1/callback`.
2. Authentication > URL Configuration: set the Site URL to the production domain, and add `https://<domain>/auth/callback`, `http://localhost:5173/auth/callback` and the preview URL to the Redirect URLs.
3. Take the project URL and the publishable key (Project Settings > API) and put them in `wrangler.jsonc` under `vars` as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Both are public by design. They must be in the file, not only on a `wrangler deploy --var` command: a Git-triggered deploy replaces any variable that is not in the file, which silently turned login off in production once. The e2e tests run through `pnpm preview:e2e`, which blanks the two variables on the command line, so they still cover the app before login is configured; to try login locally use `pnpm preview` or `pnpm dev`.
4. Run the database migrations against the same project (see "Database"): a login needs the `profiles` table.

Profile pictures are shown from Google's and Discord's image hosts, which the Content-Security-Policy allows (`img-src` in `vite.config.ts`).

To offer another provider later (Apple, Facebook, ...), enable it in Supabase, add it to `providers` in `src/lib/auth/providers.ts` and to the buttons on the login page, and allow its picture host in `img-src` if it sends one.

## Authorization

Every access decision lives in `src/lib/server/auth/policy.ts`: a pure `can(actor, action, resource)`, deny by default. Anonymous visitors, suspended accounts, unknown actions and a missing resource are all refused. The actor is the signed-in user's profile, from `await locals.getProfile()`.

```ts
import { authorize } from '$lib/server/auth/policy';
import { failFrom } from '$lib/server/errors';

export const actions = {
	edit: async ({ locals }) => {
		try {
			const table = await findTable(/* ... */);
			authorize(await locals.getProfile(), 'table:edit', table); // throws Forbidden
			// ...
		} catch (error) {
			return failFrom(error); // Forbidden -> 403, NotFound -> 404, anything else is rethrown
		}
	}
};
```

To add an action, add it to `Resources` and `rules` in `policy.ts` and cover every role and relationship in `policy.spec.ts`. ESLint forbids reading `.role` anywhere else, so a route cannot decide access by itself.

Today the policy covers creating, editing and disabling a table (any signed-in user creates; only that table's GM or an admin edits or disables). The other rows of the roadmap's permissions table (joining, rating, reporting, moderation) are added with the slices that need them.

**Make yourself admin.** There is no admin signup flow. Sign in once so your profile exists, then copy your user id (the UID column in Supabase > Authentication > Users) and run it against the database you want to change:

```sh
pnpm db:make-admin <user id>
```

or, in the Supabase SQL editor: `update profiles set role = 'admin' where id = '<user id>';`

## Theme

The site has a light and a dark theme, and follows the system by default. The header has a small labelled control (Automático, Claro, Escuro); the choice is remembered in `localStorage`, not a cookie, so it needs no banner and never leaves the browser.

- **Tokens:** the colours are theme tokens in `src/routes/layout.css` (`@theme`). The dark theme is a second set of values for the same tokens, in `:root[data-theme='dark']` and, for a reader who chose nothing, in a `prefers-color-scheme: dark` block (the two must stay identical; a test checks it). Components use **roles**, not fixed colours: `bg-surface`, `text-on-petrol`, `text-on-lamp`, `text-danger`, `--color-focus`. Never write `bg-white` or `text-red-800` in a component.
- **No flash:** a tiny inline script in `src/app.html` (with the CSP nonce) applies a remembered light or dark choice to `<html data-theme>` before the first paint. It also sets the `theme-color` meta for the browser's own chrome.
- **Contrast:** `src/lib/theme/theme.spec.ts` reads the tokens from the stylesheet and asserts WCAG AA for every pair the components use, in both themes (4.5:1 for text, 3:1 for the focus ring, the amber outline and the link underline). A palette change that breaks it fails the test. The check found that the original light amber (`#a86a00`) was below AA, so it is now `#925b00`.
- **The manifest** (`static/site.webmanifest`) can hold one colour, so it uses the light page colour.

The toggle is a native `<select>`, not Melt UI: it needs no popover and so no inline styles, which the CSP blocks.

## My tables

`/account/tables` (linked from the account menu) has two views. **Jogando** lists the tables I have a seat or a pending request at: the next session in the table's own timezone, _Sair da mesa_, a pending request shown as "Aguardando o mestre" with _Cancelar pedido_, and, once the first session has ended, a prompt to rate (or the rating already given, with a link to change it). **Mestrando** lists the tables I am the GM of, disabled ones included: the players with _Remover_, the queue of pending requests with _Aprovar_ and _Recusar_, and a link to edit or disable the table. Sessions coming up come first; a table with none left goes last. The queries are in `src/lib/server/dashboard/queries.ts`.

The buttons post to the table page's own actions (`/tables/<slug>?/leave`, `?/approve`, ...), so the rules stay in one place, and carry a `next` field that sends the browser back to the dashboard (only an on-site path is honoured). Disabling is a link to the edit page rather than a one-click button: there is no way to re-enable a table yet, so it stays a deliberate step.

## Ratings

A player who had a **confirmed** seat rates the table and its GM (1 to 5 each, and an optional comment) once the **first session has ended**; the GM cannot rate their own table. The rules are one policy function, `rateBlocker` (`table:rate`), and the service is `src/lib/server/ratings/service.ts`. A rating can be edited later (one per player, the latest wins) and records `RatingSubmitted`, with no scores or comment in the event. It is tied to the registration by a foreign key with `ON DELETE CASCADE`, so a player who leaves or is removed takes their rating with them.

Averages are **computed by a query, never stored**: `tableRating` for a table and `gmRating` across all of a GM's tables. The table page shows both averages (with how many ratings) to everyone; a comment is only ever sent back to its author. The form is native radio buttons, not Melt UI: Melt's popover-style builders need inline styles the CSP blocks (see the sign-in notes), and radios need none.

## Calendar invites

`src/lib/server/calendar/ics.ts` turns a table into an `.ics` (iCalendar) string: `buildInvite({ table, method, attendee, organizer, baseUrl })`. It is pure (no I/O, no clock unless you pass `now`), and the invite email (#13) will call it.

- **`REQUEST`** puts or updates the event; **`CANCEL`** removes it. The `UID` is the table id, so it never changes; every edit raises `SEQUENCE` (`ical_sequence`), and a calendar then replaces the event instead of adding one.
- A **one-shot** is one event; a **campaign** is one recurring event (`RRULE:FREQ=WEEKLY`, optionally `INTERVAL=2`, and `UNTIL` in UTC as the standard requires for a zoned start). Only the rules the table form builds are accepted; anything else throws.
- Times are `DTSTART;TZID=...` in the table's timezone, so a weekly 20:00 stays 20:00 across daylight-saving changes, and a `VTIMEZONE` gives the offsets to a client that does not know the zone. It lists the changes for the first three years from the first session; a recurring event that runs longer leans on the client knowing the zone by name (São Paulo has no changes, so it is one block).
- **One recipient per file**, with a single `ATTENDEE`, so nobody sees another player's address. Build one per player.
- **Escaping and folding:** text values escape `\`, `;`, `,` and line breaks; lines fold at 75 bytes without splitting a multi-byte character; the attendee name is quoted; an address, UID or recurrence that is not what this system produces throws instead of being written. Tests prove a newline in a title, description, extra info, slug or attendee name cannot add an attendee or an event, and an independent parser (`ical.js`) reads the output back.

**Check it in real calendars by hand** (this is not automated): `pnpm calendar:sample you@example.com` writes three files to `sample-invites/` (a one-shot, a weekly campaign, and its cancellation). Open them, or attach them to an email to yourself, in Gmail, Outlook and Apple Calendar. Import the campaign request, then the cancel: the event should disappear.

## Registrations

A signed-in player joins a table on its page. On an `auto` table the seat is confirmed at once; on an `approval` table the player _asks_ and the GM (or an admin) approves or declines. Only confirmed registrations take a seat: pending requests never do, so there can be more of them than seats. The GM or an admin can remove a player; a player can leave. The rules (not the GM, table active, not full, not already registered) are in the policy (`table:join`, `registration:manage`, `registration:leave`), and every operation is in `src/lib/server/registrations/service.ts`.

Capacity holds under concurrency because each operation that can take a seat first locks the table's row (`SELECT ... FOR UPDATE`) inside its transaction: two of them on one table run one after the other, and the second counts seats after the first has committed. The events (`JoinRequested`, `JoinApproved`, `JoinDeclined`, `PlayerJoined` when a seat is confirmed, `PlayerLeft` when a seat is freed) are written in the same transaction. Withdrawing a pending request frees no seat and records no event. Player names are only shown to the GM and admins.

**Integration tests.** PGlite is one connection and cannot race, so the concurrency tests (`*.integration.spec.ts`) run against real Postgres: `pnpm db:up && pnpm db:migrate && pnpm test:integration`. CI runs them against a Postgres service. They fail if the row lock is removed.

## Domain events

Every change that matters writes an event to the `events` table in the same database transaction as the change (a transactional outbox), so there is never a change without its record or a record without its change. The same table is the audit log: who (`actor_id`) did what (`type`, `payload`) and when. Rows are never deleted, and a payload holds ids and public facts only, never an email address or a token.

After the commit, the request dispatches the event to the registered handlers (`src/lib/server/events/handlers.ts`) once the response is on its way, so nobody waits for a handler. Handlers run at least once, so each must be **idempotent**: `event.id` is the key to make a repeat do nothing new. A retry runs only the handlers that have not succeeded yet.

A Cron Trigger runs the sweeper every 5 minutes. It retries events whose handlers failed, with backoff (30 s, 60 s, ... up to an hour), and picks up any event whose first dispatch never happened (the Worker stopped right after the commit). After 8 failed attempts an event is given up on: it stays in the table with `failed_at` set and the last error, for a person to look at. To find those:

```sql
select id, type, attempts, last_error, created_at from events where failed_at is not null;
```

To add an event, add it to `DomainEvent` in `src/lib/server/events/types.ts`, record it with `recordEvent(tx, ...)` inside the change's transaction, and dispatch it with `locals.afterResponse((db) => dispatchEvent(db, handlers, eventId))`. Today creating, editing and disabling a table emit `TableCreated`, `TableUpdated` and `TableDisabled`; nothing reacts to them yet (invites are #13).

The adapter only exports `fetch`, so `pnpm build` ends with `scripts/wrap-worker.ts`, which wraps SvelteKit's Worker with the `scheduled` handler. If the deploy runs plain `vite build` instead of `pnpm build`, the site works but the sweeper does not run. To try the sweeper locally: `pnpm build`, then `wrangler dev --test-scheduled` and `curl "http://localhost:8787/cdn-cgi/handler/scheduled"`.

## Logging

Server code logs through `locals.log` (or `logger` from `$lib/server/logger` outside a request). Each call writes one JSON line, and every line in a request carries the same `requestId`, taken from Cloudflare's `cf-ray` header so it matches the edge logs. A summary `request` line (method, path, status, duration) is written when each request ends.

```ts
locals.log.info('session booked', { tableId, players: 5 });
```

**Never log PII.** Pass ids and counts, not emails, names, phone numbers, CPFs, tokens or cookies. As a safety net the logger redacts fields whose names look sensitive (`email`, `token`, `password`, `cookie`, `authorization`, `phone`, `cpf`, ...) and scrubs email addresses and bearer tokens written into strings. Errors are logged as name and message only, and the query string is never logged. The net is only a net: choose what to log with care.

## Security headers

`src/lib/server/security-headers.ts` adds `X-Content-Type-Options`, `Referrer-Policy` and `Strict-Transport-Security` to every response. The `Content-Security-Policy` is set by SvelteKit (`kit.csp` in `vite.config.ts`) with a fresh nonce per response, and forbids framing (`frame-ancestors 'none'`). SvelteKit's CSRF origin check stays on; `e2e/security.e2e.ts` proves it.

Because inline styles are blocked, do not write `style="..."` in markup: use a class, or a `data-` attribute that CSS selects on. `e2e/security.e2e.ts` fails on any CSP violation, so a blocked style or script shows up in CI.

`GET /healthz` returns `{"status":"ok"}` for uptime checks.

## TypeScript 7

TypeScript 7 no longer exposes the compiler API that `svelte-check` and `typescript-eslint` are built on. Both run side by side:

- `typescript` 6 is used by ESLint.
- `@typescript/native` (TypeScript 7) type-checks through `svelte-check --tsgo`.

Drop the TS 6 copy once both tools support TS 7 natively.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), including how to fix a message or add a language.

- One issue, one small PR, closing the issue.
- Conventional commits, one concern per commit.
- Every PR builds green and includes a short test plan.
- Test behaviour, not wording: each test should name the break it catches.
