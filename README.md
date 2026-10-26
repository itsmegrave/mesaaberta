# Mesa Aberta

A scheduler for tabletop RPG tables: game masters open tables, players sign up, everyone gets a calendar invite. Planned home: mesaaberta.app (deployment is tracked in [#3](https://github.com/itsmegrave/mesaaberta/issues/3)).

The roadmap and architecture decisions live in [issue #1](https://github.com/itsmegrave/mesaaberta/issues/1).

## Stack

SvelteKit (Svelte 5, TypeScript) · Tailwind CSS · Paraglide (i18n) · Vitest · Playwright · Bun 1.4.2

## Getting started

Requirements: Bun 1.4.2, pinned in `.bun-version`, `.tool-versions` and `packageManager` in `package.json`. Node 26.8.2 (pinned in `.nvmrc`) runs Wrangler/Miniflare and the Playwright CLI; Bun remains the package manager and the runtime for project scripts and Vitest. Production still runs on Cloudflare workerd.

```sh
bun install
bun run playwright install chromium   # component and e2e tests run in a real browser
bun run dev
```

`wrangler.jsonc` and `apps/worker/wrangler.jsonc` hold placeholders, not a deployment's values: the site runs, but login, live feature flags and the footer's feedback links stay off until you set them. Put local values in `.dev.vars` (see `.dev.vars.example`); a deployment keeps its own copy of the Wrangler files.

### Self-hosting with Docker

```sh
docker compose up --build
```

This starts Postgres, Supabase Auth and Storage, applies the migrations, then runs the web app, the api (on the private network only), the background worker, Mailpit and Caddy. Open <https://localhost> (Caddy issues the certificate from its own local CA, so the browser warns once) and read the e-mails at <http://localhost:8025>: the app's own and Auth's (confirm the address, magic link, new password). Nothing needs an outside account: sign up with an e-mail and a password, open the link from Mailpit, and uploads (table images, profile pictures, partner logos) go to a local volume. Google and Discord sign-in need their own apps, so they are off.

Copy `.env.example` to `.env` to change `SITE_ADDRESS` (a real domain gets a public certificate), `APP_ORIGIN`, `API_INTERNAL_TOKEN` (the secret the web app sends to the api: change it) or the host ports. The Auth keys default to Supabase's public demo keys; before others can reach the site, generate your own with `docker run --rm -v "$PWD":/app -w /app oven/bun:1.4 bun scripts/self-host-keys.ts >> .env`. Postgres is published on 127.0.0.1 only and uses the default `mesaaberta` password, so change `POSTGRES_PASSWORD` and `DATABASE_URL` before exposing the stack. The images are `apps/web/Dockerfile`, `apps/api/Dockerfile` and `apps/worker/Dockerfile`; `docker compose up -d db` still starts only Postgres for local development.

How the pieces meet: the server reaches Auth and Storage on the Docker network through one gateway (`SUPABASE_URL=http://supabase:8000`, see `docker/supabase/Caddyfile`), and browsers load images from the site's own origin (`SUPABASE_PUBLIC_URL`), where Caddy forwards only `/auth/v1/verify` and `/storage/v1/object/public/*`. `docker/supabase/roles.sql` and `storage.sql` give the plain Postgres the schema, roles, grants and buckets a Supabase Postgres has. Storage has no write policies: the server uploads and deletes with the secret key.

`LOCAL_ONLY=true` (the default here) keeps the stack on the machine: the web app, the api and the worker refuse to start when a setting points outside (a `*.supabase.co` URL, `RESEND_API_KEY`, `SENTRY_DSN` and the like), and any request they make to a public address fails. Set `LOCAL_ONLY=false` and pass the settings to the `web`, `api` and `worker` services to connect those integrations (see `.dev.vars.example` for the names).

**Files in an S3-compatible store.** Uploads go to Supabase Storage by default. To keep them in Cloudflare R2, MinIO, AWS S3 or another S3-compatible store instead, set `STORAGE_PROVIDER=s3` with `S3_ENDPOINT` (the S3 API address, without the bucket), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_REGION` (`auto` for R2, the default) on the `web` and `worker` services, and `STORAGE_PUBLIC_URL` (where browsers read the bucket, such as `https://files.example.org`) on `web`, both when it runs and when it is built, so the Content Security Policy allows it. Everything lives in that one bucket, under `table-images/` and `profile-avatars/`, and the bucket must be publicly readable. The server writes with a signed `PUT` that never overwrites (`If-None-Match: *`) and deletes with `DELETE` (`packages/core/src/server/storage.ts`). Moving existing files is a copy of each object to the same key under its bucket's folder.

## Scripts

| Script              | What it does                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `bun run dev`       | Dev server                                                                                          |
| `bun run dev:up`    | Local Supabase with the dev personas, and `.dev.vars` pointed at it (see "Dev login")               |
| `bun run dev:local` | Dev server and api against that Supabase, with the dev login on                                     |
| `bun run build`     | Production build                                                                                    |
| `bun run lint`      | Prettier check and ESLint                                                                           |
| `bun run format`    | Prettier write                                                                                      |
| `bun run i18n`      | Compile `apps/web/messages/*.json` into `apps/web/src/lib/paraglide` (run by `prepare` and `check`) |
| `bun run check`     | Type-check `.ts` and `.svelte` files                                                                |
| `bun run test:unit` | Vitest: component tests (Chromium) and unit tests (Bun)                                             |
| `bun run e2e:up`    | Local Supabase in Docker (Postgres, Auth, Storage, mail inbox), migrated and seeded                 |
| `bun run test:e2e`  | Playwright against a production build and that Supabase, on mobile and desktop                      |
| `bun run e2e:down`  | Stops the local Supabase                                                                            |
| `bun run test`      | Unit tests, then e2e                                                                                |

## Project layout

```
apps/web/src/routes/   pages and layouts
apps/web/src/lib/      shared code, imported through #lib/...
apps/web/e2e/          Playwright tests (*.e2e.ts)
apps/web/messages/     translations
apps/api, apps/worker  the API and background Workers
packages/              code shared by the three apps
```

The web app lives in `apps/web`: every `src/...`, `e2e/...` or `messages/...` path in this README
and in CONTRIBUTING.md is relative to it. Its dependencies and scripts stay in the root
`package.json`, and `wrangler.jsonc` stays at the root, where a deployment's pipeline finds it.

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

### Maintenance mode (`maintenance_mode`)

A kill switch, off by default. Turn it on in GrowthBook (and publish) to take the site down for
maintenance; it reaches every visitor within the 60-second payload cache.

- Every page answers `503` with `Retry-After: 3600`, `Cache-Control: no-store` and `X-Robots-Tag: noindex`,
  and shows the maintenance screen at the address asked for. Form posts and endpoints get the same
  sentence as plain text, and do not run. The screen says nothing technical.
- Still reachable: `/healthz`, `/login` (with Google and Discord), `/auth/callback`, `/logout` and the
  static files. The scheduled job does not go through the pages, so it keeps running.
- A signed-in admin (`profiles.role = 'admin'`, active) uses the site as usual, with a banner saying it
  is in maintenance. Anyone else who signs in still sees the screen.
- The gate is `src/lib/server/maintenance.ts` (`handleMaintenance`, the last hook); the screen is
  `src/routes/maintenance`, which answers 404 while the flag is off.
- The local preview mode (`IGNORE_FEATURE_FLAGS_IN_LOCALHOST=true`) never turns it on.
  To try it locally, set `FEATURE_FLAG_OVERRIDES=maintenance_mode=true` in `.dev.vars`. That variable
  only works on localhost; the end-to-end tests use it for a second server (`e2e/maintenance.e2e.ts`).

## Database

Postgres through [Drizzle ORM](https://orm.drizzle.team) and `postgres.js`. Supabase provides Postgres, Auth and Storage; app data goes through Drizzle from server code, never from the browser. The schema lives in `src/lib/server/db/schema.ts` and the SQL migrations in `drizzle/` (commit them).

**Run it locally** (needs Docker):

```sh
cp .dev.vars.example .dev.vars   # DATABASE_URL for the local database
bun run db:up                       # Postgres in Docker, waits until it is healthy
bun run db:migrate                  # apply the migrations
bun run db:seed                     # optional: a GM and two tables
bun run dev
```

`bun run db:down` stops it. After changing the schema, run `bun run db:generate`, read the SQL it wrote, and commit it. Tests run the real migrations on an in-process Postgres (PGlite), so `bun run test` needs no Docker.

**RPG systems.** The systems tables are are rows in `systems`, seeded by a migration so every environment has them after `bun run db:migrate`. Each keeps its name exactly as written and has a unique slug for its URL, made by `slugify()` in `src/lib/slug.ts`; `position` keeps the source order (most played first, then A to Z). `game_tables.system_id` points at a system. Read them with `listSystems(db)` and `findSystemBySlug(db, slug)` from `#lib/server/systems`, and never keep a second list of systems. Slugs never change once shipped, because URLs and invites use them. To add a system, write a new migration with an `INSERT ... ON CONFLICT ("slug") DO NOTHING`.

**Browsing tables.** `/tables` lists active tables that still have a session ahead (soonest first, filterable by system) and `/t/<slug>` shows one; an unknown or disabled slug is the translated 404. A table past its session (awaiting the GM's confirmation, concluded or not held) is out of the list but still found at its slug, so old links work, with its status shown. The queries are in `src/lib/server/tables/queries.ts` and the next-session logic in `schedule.ts`: a weekly campaign keeps its wall-clock time in its own timezone across daylight-saving changes, and only `FREQ=WEEKLY` (with `INTERVAL`) is understood. The navigation always links to "Mesas"; sign-in is available whenever authentication is configured. Seats left are every seat until registrations exist (#11). The end-to-end tests for these pages need the seeded database and skip locally when there is none (CI always has one).

**Managing tables.** A signed-in user opens a table at `/tables/new` and becomes its GM; the GM or an admin edits it at `/t/<slug>/edit` and can disable it. Every write goes through `src/lib/server/tables/write.ts`, which asks the policy first. The form is validated with Zod (`src/lib/tables/schema.ts`); anything the form does not list (`gmId`, `status`, `slug`) is dropped. The slug comes from the title (`mesa` if it has nothing usable), is numbered `-2`, `-3` on a collision, is never `new` or `edit`, retries if two creates race for it, and never changes when the title does. Each edit raises `ical_sequence` so calendar invites replace the old event.

**After the session.** A table has a status: `active` (open), `disabled` (the GM cancelled it before the session), and, once the session is over, `awaiting_confirmation`, then `concluded` or `not_held`. The sweeper (`closeElapsedTables`, `src/lib/server/tables/lifecycle.ts`) moves every active table whose `startsAt` plus duration has passed to `awaiting_confirmation` and records `TableAwaitingConfirmation`, which puts a notification in the GM's bell; a campaign counts by its first date only, since recurrence is not managed. The GM answers on `/t/<slug>/manage`: _Aconteceu_ (`concluded`, and every confirmed player gets a `rating_prompt` notification), _Não aconteceu_ (`not_held`, nobody is notified) or _Adiar_ with a new date (back to `active` until then, with a `TableUpdated` event so invites follow). Each answer is one conditional update, so two at once cannot both win. `not_held` is not `disabled`: it is not a cancellation, so it sends no calendar `CANCEL` and does not start the chat retention.

**Platforms and tags** come from a catalog kept in `platforms` and `tags` (seeded by migration `0013`; each row has a status, and only `approved` ones are public). A table picks any number of each (`game_table_platforms`, `game_table_tags`, in the order picked); `src/lib/server/catalog.ts` reads and writes them. The suggestion and approval flow is not built yet.

**Filtering `/tables`** is all in the query string, with slugs as values and the key repeated for each value ticked: `/tables?system=daggerheart&system=savage-worlds&modality=online&platform=discord&tag=terror&tag=iniciantes`. Within a key any value matches; across keys a table has to match each. The filter is a plain GET form of checkboxes, so it works without JavaScript and every combination is a shareable link.

**Table images** are uploaded through the server: 2 MB at most, PNG, JPEG or WebP judged by the file's first bytes (never its name or the type the browser claims), and a random file name. They live in a public Supabase Storage bucket, `table-images`. Every upload and delete (table images, crowdfunding images, profile pictures and covers, partner logos) goes through the server's own Storage client (`serverStorage()` in `packages/core/src/server/storage.ts`), with the secret key (`SUPABASE_SECRET_KEY`), so Storage has no write policy for signed-in people (migration `0065_drop_storage_write_policies.sql` removed the old ones) and nobody can put a file in a bucket without the server's checks. Without that key, saving with an image fails on the image field. The buckets themselves exist in production; the local stack gets them from `config.toml`.

When Storage refuses an upload, only saving with an image fails, with a message on the image field, and the log says `image upload refused by Storage` with Storage's reason. Replaced table images are not deleted yet.

**Row level security is on for every table, with no policies** (`.enableRLS()` in `schema.ts`, and a test that fails for any table in `public` without it). Supabase serves `public` over its REST API to anyone holding the publishable key, which is public, so RLS with no policy leaves that API nothing to read or write. The app is not affected: it connects as the database owner (Hyperdrive, or the Docker Postgres), which RLS does not apply to. A new table needs `.enableRLS()`; add a policy only for one that must be reachable through the Supabase API. After deploying a migration like this, run `bun run db:migrate` against Supabase (step 4 below).

Server code reads the database from `locals.db`, which is `null` when none is configured, so the site still runs without one. `GET /healthz` (with its bearer token, see Uptime) reports `database: ok | down | not_configured` and answers 503 when a configured database does not respond.

**The deployed Worker** reaches Supabase through Hyperdrive: the `HYPERDRIVE` binding in `wrangler.jsonc` holds the Hyperdrive config id (not a secret). To set it up from scratch:

1. In Supabase, open Connect and copy the **session pooler** connection string (port 5432). Hyperdrive does its own pooling, so do not use the transaction pooler (port 6543).
2. `wrangler hyperdrive create mesaaberta-db --connection-string="<that string>"` prints an id.
3. Put the id in the `hyperdrive` block of `wrangler.jsonc`.
4. Run the migrations against Supabase once: `DATABASE_URL="<direct or session string>" bun run db:migrate`.
5. Deploy, then check `/healthz` shows `"database": "ok"`.

**Locally**, the binding's `localConnectionString` points at the Docker Postgres, so `bun run dev`, `wrangler dev` and the e2e tests use it without `.dev.vars`: run `bun run db:up && bun run db:migrate` first. With the binding in place and no database running, `/healthz` reports `down` (503) rather than `not_configured`. The `db:*` scripts still read `DATABASE_URL` from `.dev.vars`.

Limits checked on 2026-09-19: Supabase's free Nano compute allows 60 direct and 200 pooler connections ([compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk)); Hyperdrive on the free plan allows about 20 origin connections per configuration and 10 configurations per account ([limits](https://developers.cloudflare.com/hyperdrive/platform/limits/)). The Worker opens at most 5 connections per request, so both are comfortable for now. Check the pages again before relying on the numbers.

## Sign-in

Sign-in goes through Supabase Auth (Google and Discord) with cookie sessions from `@supabase/ssr` and the PKCE flow. The flow is server-side: `/login/<provider>` starts it, `/auth/callback` finishes it and creates a `member` profile on the first login, and `POST /logout` ends it. Login is off until the Supabase settings exist: the site runs, and the "Entrar" link is hidden.

In server code, ask who is signed in through `locals.getUser()`. It asks Supabase to verify the session token, and never trusts the cookie on its own. To protect a page or an action:

```ts
import { requireUser } from '#lib/server/auth/guard.ts';

export const load = async ({ locals, url }) => {
  const user = await requireUser(locals, url); // anonymous visitors go to /login and come back
  // ...
};
```

**Email and password** (`/signup` and `/login`) is Supabase Auth's own email login: Supabase stores the hashed password, sends the confirmation email and verifies the session. We store nothing and only call it (`src/lib/server/auth/email.ts`), then make sure the person has a profile. Sign-up creates the account and Supabase emails a confirmation link (which comes back to `/auth/callback`); until it is confirmed, sign-in answers "confirm your email". A wrong password and an unknown address get the same message, and a repeat sign-up says the same "check your email" as a first one, so neither can be used to find out who is registered. The email address and the password are never logged. Passwords are 8 to 72 characters (72 is where bcrypt cuts off).

**Ending a table.** Owners can permanently delete a draft (`DELETE /v1/tables/:slug/draft`) or close a published table (`POST /v1/tables/:slug/close`). Both are API-owned operations with no migration-flag or local-write fallback. Deletion locks and rechecks the draft, removes its catalog links and conversation, and retains only opaque IDs in its ordinary audit retention. Copies keep working when their source is deleted. Closing is idempotent, preserves confirmed participants and history, cancels pending requests, and emits one `TableDisabled` event for cancellation notices and calendar updates. Concluded and not-held sessions keep their final state.

**Shared table images.** Deleting a draft currently retains its Storage object. Copies can share the same image, and no transactionally safe reference-aware garbage collector exists yet. An image must not be deleted based only on a one-time reference count, which can race a new copy.

**Calendar invites** are transactional Resend messages, sent from the event outbox after a seat is confirmed and cancelled when the player leaves or the table is disabled. Editing an open table updates every confirmed player's invite. Set `RESEND_API_KEY`, `RESEND_FROM`, `SUPABASE_SECRET_KEY` (a Supabase secret key, `sb_secret_...`; the legacy `service_role` key still works as `SUPABASE_SERVICE_ROLE_KEY` until Supabase retires it), and optionally `APP_ORIGIN` as Worker secrets; the handler stays off until all required values exist. It looks up a recipient through Supabase Auth's Admin API at send time, so no email address is copied into `profiles`, registrations, or the permanent event payload. Set the first three with `wrangler secret put <NAME>` (not `wrangler.jsonc`), and make `RESEND_FROM` a verified Resend sender. Each Resend request uses the event id and recipient id as its idempotency key, so an outbox retry cannot duplicate an invite. The copy is hosted in Resend; see "Hosted e-mail templates" under Calendar invites.

**Password reset** uses Supabase's recovery flow. `/forgot` asks for an email and always answers "if the address has an account, we sent a link" (Supabase does not say whether it does, and neither do we). The link comes back through `/auth/callback`, which signs the person in and sends them to `/reset`, where they choose a new password (typed twice, 8 to 72 characters). Changing it signs every other session out, in case whoever knew the old password was still in. `/reset` is only for someone a recovery link just signed in: without a session it sends them to ask for a new link. Because sign-in uses PKCE, the link only works in the browser that asked for it; opened elsewhere, the login page says to open it in the same browser or ask again. The address and the passwords are never logged. Supabase's Reset Password email template needs no change: it already sends `{{ .ConfirmationURL }}`, which returns to the redirect URLs set for the social providers.

**Supabase settings for email login** (Authentication in the dashboard):

- **SMTP.** Supabase's built-in email sender only delivers to your own team's addresses and is heavily rate limited: real people will not get their confirmation link until you set a custom SMTP under Emails > SMTP Settings (Resend is the plan for #13; its SMTP credentials work here too).
- **Sign In / Providers > Email:** leave "Confirm email" on, and set the minimum password length to 8 to match the form.
- **URL Configuration:** the Site URL and the redirect URLs for `/auth/callback`, as for the social providers.

**Set it up** (one-time, needs your Supabase account and one OAuth app per provider):

1. In the Supabase project, open Authentication > Providers and enable Google and Discord. Each needs an OAuth app at the provider; its callback URL is Supabase's own, `https://<project>.supabase.co/auth/v1/callback`.
2. Authentication > URL Configuration: set the Site URL to the production domain, and add `https://<domain>/auth/callback`, `http://localhost:5173/auth/callback` and the preview URL to the Redirect URLs.
3. Take the project URL and the publishable key (Project Settings > API) and put them in `wrangler.jsonc` under `vars` as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Both are public by design. They must be in the file, not only on a `wrangler deploy --var` command: a Git-triggered deploy replaces any variable that is not in the file, which silently turned login off in production once. The e2e tests do not use these values: they start the app with the local Supabase's own URL and key (see "End-to-end tests" below).
4. Run the database migrations against the same project (see "Database"): a login needs the `profiles` table.

Profile pictures are shown from Google's and Discord's image hosts, which the Content-Security-Policy allows (`img-src` in `vite.config.ts`).

**Profile pictures.** A person can upload their own picture on `/u/profile/edit` (same checks as table images: 2 MB, PNG, JPEG or WebP by its first bytes). It goes to the public `profile-avatars` bucket under a folder named after their user id, and it wins over the provider's picture; removing it goes back to the provider's, and a replaced file is deleted (only ever inside that person's folder). The picture shown is `pictureOf()` in `src/lib/server/images.ts`.

**Partner logos.** A member sending a partner on `/partners/new` uploads its square logo (same checks as profile pictures). It goes to the same public `profile-avatars` bucket, under `partners/<user id>/`, and a replaced logo is deleted. Every partner waits for an admin before it is public, and editing an approved one sends it back to review.

To offer another provider later (Apple, Facebook, ...), enable it in Supabase, add it to `providers` in `src/lib/auth/providers.ts` and to the buttons on the login page, and allow its picture host in `img-src` if it sends one.

### Dev login

A local dev server can sign in as a test persona without a password, so a person or an agent can look at the app as a member, a GM or an admin. `bun run dev:up` starts the local Supabase (as `e2e:up` does, and the Docker daemon first when it is not running and it can: as root with `dockerd` installed, like a cloud session; otherwise it says to start Docker), creates the personas in its Auth and writes their settings to `.dev.vars`; `bun run dev:local` starts `vite dev` and the api against it. Then open `http://localhost:5173/dev/login?as=gm&next=/t/os-sinos-de-sablewood/manage`; `/dev/logout` signs out. `bun scripts/dev/shot.ts --as gm /path` saves desktop and phone screenshots.

| Persona  | Who                                                     |
| -------- | ------------------------------------------------------- |
| `member` | A member who finished onboarding                        |
| `gm`     | The seeded GM, who owns the seeded tables               |
| `player` | A member with a seat at Os Sinos de Sablewood           |
| `admin`  | An admin                                                |
| `new`    | Someone without a username, sent to the onboarding step |

It signs in through the real Supabase login (`signInWithPassword`), so `getUser()`, the policy and the api are unchanged. It never reaches production: `apps/web/src/lib/server/dev` is loaded only when `import.meta.env.DEV` (so not by any build), and even then answers 404 unless `DEV_LOGIN=true`, the request is for `localhost` and `SUPABASE_URL` is a local Supabase. CI builds the app and fails if the route or a persona is in the output (`scripts/check-no-dev-login.ts`), the e2e suite checks it is a 404 on the production build, and ESLint keeps every other module from importing it. Run `bun run e2e:up` before the e2e suite: it resets the seat the `player` persona takes.

In a Claude Code cloud session, `.claude/settings.json` starts all of this in the background (`scripts/dev/cloud-session.sh`, only when `CLAUDE_CODE_REMOTE=true`); its log is `/tmp/mesaaberta-dev-up.log`.

## Authorization

Every access decision lives in `src/lib/server/auth/policy.ts`: a pure `can(actor, action, resource)`, deny by default. Anonymous visitors, suspended accounts, unknown actions and a missing resource are all refused. The actor is the signed-in user's profile, from `await locals.getProfile()`.

```ts
import { authorize } from '#lib/server/auth/policy';
import { failFrom } from '#lib/server/errors';

export const actions = {
  edit: async ({ locals }) => {
    try {
      const table = await findTable(/* ... */);
      authorize(await locals.getProfile(), 'table:edit', table); // throws Forbidden
      // ...
    } catch (error) {
      return failFrom(error); // Forbidden -> 403, NotFound -> 404, anything else is rethrown
    }
  },
};
```

To add an action, add it to `Resources` and `rules` in `policy.ts` and cover every role and relationship in `policy.spec.ts`. ESLint forbids reading `.role` anywhere else, so a route cannot decide access by itself.

Today the policy covers creating, editing and disabling a table (any signed-in user creates; only that table's GM or an admin edits or disables), joining and rating, reporting (a table, or a person the reporter shares a table with, never oneself) and moderation (admins only; an admin cannot ban themselves or another admin). `activeAdmins()` is the same rule as a query condition, for finding who to notify.

**Moderation.** A member reports a table or a player from the table page ("Denunciar"); one report per reporter and target waits at a time, and `REPORT_LIMIT` caps them per day. Admins work the queue at `/admin/reports`. A table report can close the table: it is disabled (players get the usual cancellation) and the justification is stored with the table and the GM is told in the bell (a disabled table is a 404, so there is no page to show it on yet). A player report can ban the profile for 7, 30 or 90 days or for good, and the person gets an e-mail with the reason (`ban-mail-v1`). A ban signs the account out, refuses its sign-in, disables the tables it runs and takes its seats; a temporary one ends by itself (`liftExpiredBans`, on the Cron and on the person's next request). The user's admin page counts the accepted reports against the tables they run and warns from `TABLE_REPORTS_WARNING`; banning from there is the admin's call. Every decision is an event, listed at `/admin/audit` for as long as events are kept.

**Make yourself admin.** There is no admin signup flow. Sign in once so your profile exists, then copy your user id (the UID column in Supabase > Authentication > Users) and run it against the database you want to change:

```sh
bun run db:make-admin <user id>
```

or, in the Supabase SQL editor: `update profiles set role = 'admin' where id = '<user id>';`

## Public profile

A profile has a required, public **username** (`profiles.username`: 3 to 30 lowercase letters, digits and single hyphens, unique whatever the case), and optional details: a `name` (pre-filled from the sign-in provider when it sends one; never from the email address), `age`, `gender`, `city`, and any number of social links in `profile_social_links` (network, address, position; up to 10). Everything but the username is optional. The username rules live in one module for the browser and the server, `src/lib/profile/username.ts` (format, length, and a reserved list: add a name there whenever you add a top-level route), and the form's Zod schema is in `src/lib/profile/schema.ts`. The database repeats the format in a check constraint and enforces uniqueness with an index on `lower(username)`; a lost race between two people is reported as the same "taken" field error as a name that was taken all along.

**Onboarding.** Right after a first sign-in (OAuth or email) the person lands on `/u/profile/setup?next=<where they were going>`, a form built with TanStack Form and TanStack Query (Zod validation in the browser and on the server, one mutation per submit, and a native POST fallback). The username is checked while it is typed through `GET /u/profile/setup/username?value=...`, which answers only `free`, `taken` or `invalid` and only to signed-in people; it is advice, the unique index still decides. The gate is `requireUser` (`src/lib/server/auth/guard.ts`): someone without a username is sent to the onboarding from every authenticated page and form action, and brought back afterwards. Public pages stay public and so does logging out. Profiles that predate usernames get one from their old display name by the migration where an acceptable one comes out of it (a numeric suffix on a repeat), and pick one at the onboarding otherwise. Until then they show as "jogador".

**Deploying.** Production deploys come from the private infra repository's pinned tagged release; Cloudflare Workers Builds is disconnected. That pipeline applies the release's pending migrations from `drizzle/` **before** the new Worker serves traffic, and a failed migration stops the deploy, so the code never runs ahead of its schema. Local builds, GitHub CI and preview branches never touch production. `scripts/migrate-on-deploy.ts` acts only on a Workers Build of `main`, so it no longer runs anywhere. To apply migrations by hand, run `DATABASE_URL="<session pooler string>" bun run db:migrate`.

The connection verifies Supabase's certificate against its root CA, kept at `supabase/prod-ca-2021.crt` (public; valid until 2031, when Supabase rotates it, replace the file). Write migrations so the release before them still works (add, then use; stop using, then drop in a later release), because the old Worker serves traffic while the deploy runs. `0008` (drops `profiles.display_name`) was the one exception: the release before it errors on the queries that name it until the new one is live.

## Theme

The site has a light and a dark theme, and follows the system by default. The header has a small labelled control (Automático, Claro, Escuro); the choice is remembered in `localStorage`, not a cookie, so it needs no banner and never leaves the browser.

- **Tokens:** the colours are theme tokens in `src/routes/layout.css` (`@theme`). The dark theme is a second set of values for the same tokens, in `:root[data-theme='dark']` and, for a reader who chose nothing, in a `prefers-color-scheme: dark` block (the two must stay identical; a test checks it). Components use **roles**, not fixed colours: `bg-surface`, `text-on-petrol`, `text-on-lamp`, `text-danger`, `--color-focus`. Never write `bg-white` or `text-red-800` in a component.
- **No flash:** a tiny inline script in `src/app.html` (with the CSP nonce) applies a remembered light or dark choice to `<html data-theme>` before the first paint. It also sets the `theme-color` meta for the browser's own chrome.
- **Contrast:** `src/lib/theme/theme.spec.ts` reads the tokens from the stylesheet and asserts WCAG AA for every pair the components use, in both themes (4.5:1 for text, 3:1 for the focus ring, the amber outline and the link underline). A palette change that breaks it fails the test. The check found that the original light amber (`#a86a00`) was below AA, so it is now `#925b00`.
- **The manifest** (`static/site.webmanifest`) can hold one colour, so it uses the light page colour.

The toggle is a native `<select>`, not Melt UI: it needs no popover and so no inline styles, which the CSP blocks.

## My tables

`/u/tables` (linked from the account menu) has two views. **Jogando** lists the tables I have a seat or a pending request at: the next session in the table's own timezone, _Sair da mesa_, a pending request shown as "Aguardando o mestre" with _Cancelar pedido_, and, once the first session has ended, a prompt to rate (or the rating already given, with a link to change it). **Mestrando** lists the tables I am the GM of, disabled ones included: the players with _Remover_, the queue of pending requests with _Aprovar_ and _Recusar_, and a link to edit or disable the table. Sessions coming up come first; a table with none left goes last. The queries are in `src/lib/server/dashboard/queries.ts`.

The buttons post to the table page's own actions (`/t/<slug>?/leave`, `?/approve`, ...), so the rules stay in one place, and carry a `next` field that sends the browser back to the dashboard (only an on-site path is honoured). Disabling is a link to the edit page rather than a one-click button: there is no way to re-enable a table yet, so it stays a deliberate step.

## Messages

Table chats and direct messages share one inbox (`/messages`, two panes on desktop, a thread per screen on phones); a table chat is a **group** conversation, a direct one is between two people. Tables are `conversations`, `conversation_members` and `messages` (all with RLS on and no policy, like every table). The server side is `src/lib/server/messages/`: `access.ts` holds who may read and write (a table chat follows the registrations live: the GM and confirmed players; anyone may write to the GM of an active table before joining, and a GM to their own players), `service.ts` sends, lists and marks read, and `retention.ts` deletes a table's chat 90 days after the table is disabled (called by the cron sweeper, so it imports relatively only).

A person can turn direct messages off in the profile (`profiles.direct_messages_enabled`): nobody new can start a conversation with them, existing ones stop taking messages, and table chats are not affected. Membership of a table chat is synced in the same transactions that approve, join, leave or remove a player.

Sending is one transaction: the message, `last_message_at`, the sender's read mark and one **grouped** `message_received` notification per other unmuted member (a partial unique index keeps one unread per conversation and the count goes up: "3 novas mensagens de @ana"). Messages do not write domain events: the event log keeps ids and public facts, and a chat is neither. The limit is `MESSAGE_LIMIT` (30 a minute), counted from the messages themselves.

There is no push: the open thread polls `/api/messages/<id>` every 3 seconds while the tab is visible, the inbox refreshes every 30 seconds and the header polls `/api/badges` for the bell and the messages count. Real time is planned as a Durable Object per conversation (partyserver) behind the same reads.

## Ratings

A player who had a **confirmed** seat rates the table and its GM (1 to 5 each, and an optional comment) once the **GM has confirmed the session happened** (the table is `concluded`); the GM cannot rate their own table. The rules are one policy function, `rateBlocker` (`table:rate`), and the service is `src/lib/server/ratings/service.ts`. A rating can be edited later (one per player, the latest wins) and records `RatingSubmitted`, with no scores or comment in the event. It is tied to the registration by a foreign key with `ON DELETE CASCADE`, so a player who leaves or is removed takes their rating with them.

Averages are **computed by a query, never stored**: `tableRating` for a table and `gmRating` across all of a GM's tables. The table page shows both averages (with how many ratings) to everyone; a comment is only ever sent back to its author. The form is native radio buttons, not Melt UI: Melt's popover-style builders need inline styles the CSP blocks (see the sign-in notes), and radios need none.

## Calendar invites

`src/lib/server/calendar/ics.ts` turns a table into an `.ics` (iCalendar) string: `buildInvite({ table, method, attendee, organizer, baseUrl })`. It has no I/O and no clock unless you pass `now`, and the invite email (#13) will call it. It does not write the format by hand: **[ical.js](https://github.com/kewisch/ical.js)** (Mozilla's library, MPL-2.0) does the serializing (escaping, folding, parameter quoting), and **[timezones-ical-library](https://github.com/add2cal/timezones-ical-library)** (Apache-2.0) supplies the time zone rules. The library embeds them, so it works in a Worker; the more familiar `@touch4it/ical-timezones` reads its zone files from disk and cannot. The module is 256 KiB bundled (56 KiB gzipped), checked by running it in the Workers runtime.

This file decides what goes in an invite and checks what comes from users or the database before it gets near the library.

- **`REQUEST`** puts or updates the event; **`CANCEL`** removes it. The `UID` is the table id, so it never changes; every edit raises `SEQUENCE` (`ical_sequence`), and a calendar then replaces the event instead of adding one.
- A **one-shot** is one event; a **campaign** is one recurring event (`RRULE:FREQ=WEEKLY`, optionally `INTERVAL=2`, and `UNTIL` in UTC as the standard requires for a zoned start). Only the rules the table form builds are accepted; anything else throws.
- Times are `DTSTART;TZID=...` in the table's timezone, with the zone's own rules in a `VTIMEZONE` (including its yearly daylight-saving recurrence), so a weekly 20:00 stays 20:00 across every change, in any year.
- **One recipient per file**, with a single `ATTENDEE`, so nobody sees another player's address. Build one per player.
- **Every line break in a text is turned into a plain `\n` before the library sees it.** ical.js escapes `\n` but leaves a `\r` as it is, and a bare CR ends a line for a lenient parser, so without this a title could add an attendee. An address, UID, timezone or recurrence that is not what this system produces throws. Tests prove a newline in a title, description, extra info, slug or attendee name cannot add an attendee or an event, and that the output is identical whatever time zone the machine runs in.
- **Known small deviation:** ical.js folds at 75 bytes of content plus the folding space, so a continuation line can be 76 octets (the standard says "should not exceed 75"; every mainstream client reads it). It never splits a character.

**Check it in real calendars by hand** (this is not automated): `bun run calendar:sample you@example.com` writes three files to `sample-invites/` (a one-shot, a weekly campaign, and its cancellation). Open them, or attach them to an email to yourself, in Gmail, Outlook and Apple Calendar. Import the campaign request, then the cancel: the event should disappear.

### Hosted e-mail templates

The copy of these e-mails is not built in the app. Each one is a **hosted, versioned template in the Resend dashboard**; the app sends the template id and a few variables (`src/lib/server/mail/templates.ts`), plus the per-recipient `.ics` attachment and the idempotency key. Until a template id is configured, that e-mail is sent with the short inline text it had before, so invites keep going out while the templates do not exist yet. A missing or blank id never stops the handler; each template is independent. The player-invitation template adds `GM_NAME` and `EXPIRES_AT` and sends no private welcome/access information. The account-banned template takes its own variables (`RECIPIENT_NAME`, `BAN_SUMMARY`, `BAN_REASON`, `FALLBACK_TEXT`) rather than the seven below.

**Worker variables** (ids are not secrets). Put them in `vars` in `wrangler.jsonc` once the templates exist, next to `RESEND_FROM`: a Git-triggered deploy replaces any variable that is not in that file. Use the template's id (a UUID) or its alias. For local runs, set them in `.dev.vars` (see `.dev.vars.example`).

| Worker variable                     | Template                       | Sent when                                                                            |
| ----------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `RESEND_TEMPLATE_INVITE`            | `mesaaberta-invite`            | A seat is confirmed, or a table is edited (calendar `REQUEST`, with the `.ics`)      |
| `RESEND_TEMPLATE_CANCEL`            | `mesaaberta-cancel`            | A player leaves or the table is disabled (calendar `CANCEL`, with the `.ics`)        |
| `RESEND_TEMPLATE_JOIN_REQUESTED`    | `mesaaberta-join-requested`    | A player asks to join: goes to the GM                                                |
| `RESEND_TEMPLATE_JOIN_DECLINED`     | `mesaaberta-join-declined`     | The GM declines a request: goes to the player                                        |
| `RESEND_TEMPLATE_PLAYER_INVITATION` | `mesaaberta-player-invitation` | A GM reserves a seat for consent: no calendar or private details                     |
| `RESEND_TEMPLATE_ACCOUNT_BANNED`    | `mesaaberta-account-banned`    | An admin bans an account: goes to that person, with the reason (no table, no `.ics`) |

**Variables.** These eight are the only values that reach Resend, and every template receives the first six, plus `WELCOME_MESSAGE` for `mesaaberta-invite` and `PLAYER_MESSAGE` for `mesaaberta-join-requested` when they apply (`TEMPLATE_VARIABLES`; a unit test pins the list, and another checks that no id, address, token or secret is in the payload). Create the six in each template and give each a fallback value: Resend rejects a send when a variable in the template has neither a value nor a fallback, and we do not know whether it also rejects a variable the template does not define.

| Variable          | Type   | Content                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RECIPIENT_NAME`  | string | The recipient's display name                                                                                                                                                                                                                                                                                                                           |
| `TABLE_TITLE`     | string | The table's title                                                                                                                                                                                                                                                                                                                                      |
| `TABLE_URL`       | string | Link to the public table page                                                                                                                                                                                                                                                                                                                          |
| `CONTEXT`         | string | `REQUEST`, `CANCEL`, `JOIN_REQUESTED` or `JOIN_DECLINED`                                                                                                                                                                                                                                                                                               |
| `STARTS_AT`       | string | The session start as people say it, in the table's own time zone, pt-BR (for example `sábado, 10 de outubro, 19:00 GMT-3`)                                                                                                                                                                                                                             |
| `FALLBACK_TEXT`   | string | The one-line plain-text copy the app would send without a template                                                                                                                                                                                                                                                                                     |
| `PLAYER_MESSAGE`  | string | Optional, `mesaaberta-join-requested` only. The player's introduction written when asking for the seat, as HTML: an `<h3>Mensagem de @usuário</h3>` and the escaped text after it. Absent when the player wrote nothing                                                                                                                                |
| `WELCOME_MESSAGE` | string | Optional, `mesaaberta-invite` only. The game master's welcome message for the table as HTML (the small set of tags of the rich-text editor), with its own heading: an `<h3>Mensagem da mesa</h3>` and the message after it. Sent only when a player has just got a seat (`JoinApproved`, `PlayerJoined`) and the table has a message; otherwise absent |

Names follow Resend's rules (ASCII letters, digits and underscores, up to 50 characters; `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`, `contact` and `this` are reserved). Values are strings of at most 2,000 characters; the app also removes `<` and `>` from them (except in `WELCOME_MESSAGE`, which is cleaned to an allowlist of tags), since users write titles and names and Resend does not say whether `{{{VAR}}}` escapes. Use `{{{VAR}}}` in the body.

**What Resend accepts** (from its API reference): with a `template`, the request may not carry `html`, `text` or `react`, so the plain-text copy travels as `FALLBACK_TEXT`. `subject` and `from` may be sent and win over the template's defaults; the app always sends the subject listed below, so the subject you set in the template is only a default. Attachments are not excluded, and the `.ics` is kept.

**Suggested copy (pt-BR).** Create four templates in the Resend dashboard (Templates > Create template), named as in the table above, with the subject and body below. Keep the body short and plain; the `.ics` carries the details.

`mesaaberta-invite`, subject `Convite: {{{TABLE_TITLE}}}`

> Olá, {{{RECIPIENT_NAME}}}!
> Sua vaga na mesa **{{{TABLE_TITLE}}}** está confirmada. A sessão começa {{{STARTS_AT}}}.
> {{{WELCOME_MESSAGE}}} (HTML)
> O convite de calendário está anexado: abra o arquivo para adicionar a mesa à sua agenda. Se a mesa mudar, você receberá um novo convite que atualiza o evento.
> [Ver a mesa]({{{TABLE_URL}}})

`WELCOME_MESSAGE` must be defined in this template with an **empty fallback value** (or a single space if the dashboard refuses an empty one), and the line above must hold the variable and nothing else, no heading of its own: Resend templates have no conditionals, so a heading in the template would be shown above nothing when the table has no message or the invite is an update. The heading travels inside the variable for that reason. The variable is HTML, so it goes in a block of its own (`<div>{{{WELCOME_MESSAGE}}}</div>`), never inside a `<p>`, and without `white-space: pre-line`. A template created before the message became rich text needs that block changed in the Resend dashboard. If the message does not fit in 2,000 characters it is sent as plain paragraphs, cut with an ellipsis.

`mesaaberta-cancel`, subject `Cancelada: {{{TABLE_TITLE}}}`

> Olá, {{{RECIPIENT_NAME}}}.
> Sua participação na mesa **{{{TABLE_TITLE}}}** foi cancelada. O cancelamento de calendário está anexado: abra o arquivo para remover o evento da sua agenda.
> [Ver a mesa]({{{TABLE_URL}}})

`mesaaberta-join-requested`, subject `Nova solicitação: {{{TABLE_TITLE}}}`

> Olá, {{{RECIPIENT_NAME}}}!
> Há uma nova solicitação para entrar na sua mesa **{{{TABLE_TITLE}}}**. Abra a mesa para aprovar ou recusar.
> {{{PLAYER_MESSAGE}}} (HTML)
> [Ver a mesa]({{{TABLE_URL}}})

`PLAYER_MESSAGE` follows the same rules as `WELCOME_MESSAGE` above, in this template only: define it with an **empty fallback value**, keep it alone in a block of its own (`<div>{{{PLAYER_MESSAGE}}}</div>`) with no heading in the template, because the heading (`<h3>Mensagem de @usuário</h3>`) travels inside the variable and is absent when the player wrote nothing. The text is the player's introduction, escaped, read when the e-mail is sent and never stored in the event. A template created before this variable existed needs it added in the dashboard and published _before_ the code that sends it is deployed.

`mesaaberta-join-declined`, subject `Solicitação recusada: {{{TABLE_TITLE}}}`

> Olá, {{{RECIPIENT_NAME}}}.
> Sua solicitação para a mesa **{{{TABLE_TITLE}}}** foi recusada. Há outras mesas abertas esperando por você.
> [Ver a mesa]({{{TABLE_URL}}})

**Preview and test.** In the template editor, use the dashboard's test e-mail and fill in sample values for the six variables (for example the ones in the table above). Check it in Gmail, Outlook and Apple Mail, on a phone and in dark mode. To exercise the real path, put the ids in `.dev.vars` together with a real `RESEND_API_KEY` and a `RESEND_FROM` on a verified domain, and join a table with an account whose address is yours. The automated tests never call Resend.

**Safe update procedure.** A template has a draft and a published version, and only the published one is sent. Edit the draft, test it, then publish; the next e-mail uses it. Nothing to deploy, since the id does not change. To undo, use the version history (revert creates a new draft, then publish it). Adding a variable is two steps in this order: add it to the template with a fallback value and publish, then deploy the code that sends it. Removing one is the reverse. To go back to the inline copy, empty or delete the `RESEND_TEMPLATE_*` variable and deploy.

**Errors.** A refused send (a wrong id, an unpublished template, a variable without a value or fallback) throws, like any failed send, so the outbox sweeper retries it every five minutes. It does not fall back to the inline copy by itself. If a template is misconfigured, unset its variable to keep e-mails flowing.

**Later variables.** The GM's welcome message will be one optional string variable (`WELCOME_MESSAGE`): one line in the `TemplateVariables` type and one in `TEMPLATE_VARIABLES`. An absent value is left out of the request, so the template must give it a fallback value.

## Registrations

A signed-in player joins a table on its page. On an `auto` table the seat is confirmed at once; on an `approval` table the player _asks_ and the GM (or an admin) approves or declines. Only confirmed registrations take a seat: pending requests never do, so there can be more of them than seats. The GM or an admin can remove a player; a player can leave. The rules (not the GM, table active, not full, not already registered) are in the policy (`table:join`, `registration:manage`, `registration:leave`), and every operation is in `src/lib/server/registrations/service.ts`.

A table can also carry an optional **minimum of players** (`game_tables.min_players`, blank means none, never more than the seats). It is information for the GM and the players, not a rule: the table page and the manage page show it and how many are still missing, but nothing stops a table below it, and changing it sends no invite.

Capacity holds under concurrency because each operation that can take a seat first locks the table's row (`SELECT ... FOR UPDATE`) inside its transaction: two of them on one table run one after the other, and the second counts seats after the first has committed. The events (`JoinRequested`, `JoinApproved`, `JoinDeclined`, `PlayerJoined` when a seat is confirmed, `PlayerLeft` when a seat is freed) are written in the same transaction. Withdrawing a pending request frees no seat and records no event. Player names are only shown to the GM and admins.

**End-to-end tests.** They run against a real Supabase in Docker, not against mocks: `bun run e2e:up` (starts the stack, applies the migrations, seeds), `bun run test:e2e`, `bun run e2e:down`. Playwright builds the app and starts a fresh `wrangler dev` on port 4173, pointed at that stack (its URL, key, database and Mailpit URL come from `supabase status`). It never reuses a server already on that port, and forces transactional e-mail through Mailpit, so E2E tests cannot deliver calendar e-mail through Resend even if `.dev.vars` has real credentials. Sign-up, email confirmation, password reset and app calendar invites read from the stack's Mailpit inbox (http://127.0.0.1:54344); signed-in flows create users through the Auth admin API and sign in through the real form; the table image goes to the real Storage bucket. The stack uses ports 54341 to 54344, so it does not clash with `bun run db:up` (5432) or a Supabase you run for other projects. The tests run one at a time because they share the database. To try a branch whose migrations that stack does not have yet without touching its database, create a database of your own in the same Postgres, migrate and seed it with `DATABASE_URL`, and run Playwright with `E2E_DB_URL` pointing at it. The Docker Postgres from `bun run db:up` is still what `bun run dev` and the integration tests use.

**Integration tests.** PGlite is one connection and cannot race, so the concurrency tests (`*.integration.spec.ts`) run against real Postgres: `bun run db:up && bun run db:migrate && bun run test:integration`. CI runs them against a Postgres service. They fail if the row lock is removed.

## Domain events

Every change that matters writes an event to the `events` table in the same database transaction as the change (a transactional outbox), so there is never a change without its record or a record without its change. The same table is the audit log: who (`actor_id`) did what (`type`, `payload`) and when. A row is kept for 90 days after it finishes (processed or given up on), then the sweeper deletes it (`RETENTION_DAYS`, the period the privacy policy promises); a payload holds ids and public facts only, never an email address or a token. One type is the exception: `UserSignedIn` is the connection log Marco Civil da Internet (art. 15) requires kept for 6 months, so it survives until `CONNECTION_RETENTION_DAYS` instead — its payload is just the visitor's IP address, recorded on every OAuth and email/password sign-in (`recordConnection`, `src/lib/server/events/outbox.ts`).

After the commit, the request dispatches the event to the registered handlers (`src/lib/server/events/handlers.ts`) once the response is on its way, so nobody waits for a handler. Handlers run at least once, so each must be **idempotent**: `event.id` is the key to make a repeat do nothing new. A retry runs only the handlers that have not succeeded yet.

A Cron Trigger runs the sweeper every 5 minutes. First it asks the GM about every table whose session is over (see "After the session" under Managing tables). It retries events whose handlers failed, with backoff (30 s, 60 s, ... up to an hour), and picks up any event whose first dispatch never happened (the Worker stopped right after the commit). After 8 failed attempts an event is given up on: it stays in the table with `failed_at` set and the last error, for a person to look at. To find those:

```sql
select id, type, attempts, last_error, created_at from events where failed_at is not null;
```

To add an event, add it to `DomainEvent` in `src/lib/server/events/types.ts`, record it with `recordEvent(tx, ...)` inside the change's transaction, and dispatch it with `locals.afterResponse((db) => dispatchEvent(db, handlers, eventId))`. Today creating, editing and disabling a table emit `TableCreated`, `TableUpdated` and `TableDisabled`; nothing reacts to them yet (invites are #13).

The web Worker is SvelteKit's own output and only answers requests. The sweeper and the daily import run on the background Worker (`apps/worker`), which has the Cron Triggers; see its README to try them locally.

## Rate limiting

Any signed-in member may open a table and join one, so both are limited per person. `src/lib/server/rate-limit.ts` holds the limits as named constants and the check:

| Limit                  | Counts                           | Allowed              |
| ---------------------- | -------------------------------- | -------------------- |
| `TABLE_CREATION_LIMIT` | `TableCreated` events            | 5 in any 60 minutes  |
| `JOIN_LIMIT`           | `PlayerJoined` + `JoinRequested` | 20 in any 60 minutes |

Workers keep nothing in memory between requests, so nothing is cached: the count is read from the `events` table, which already has a row per creation and per join, keeps it far longer than the hour a limit looks back, and is indexed by `(actor_id, created_at)`. There is no extra table to clean up. Leaving a table and joining again counts as a new join. Admins get no exemption, because the policy gives them no special right to open or join tables.

`enforceRateLimit(tx, actorId, LIMIT)` is called in the same transaction as the write it limits, after validation and the policy checks: a refused request writes nothing and never uses the limit up (a full table or a form with errors does not count). It takes a per-person advisory lock, so two simultaneous requests cannot both slip through on the last slot. It throws `RateLimited`, which `failFrom` turns into a `429` form failure carrying `retryAfter` (seconds until one use ages out); the page shows "Tente de novo em 15 min", and the response has a `Retry-After` header. `checkRateLimit` is the same check without the lock, for a cheap look before costly work: the create form uses it so a limited person does not upload an image first.

To limit something else (reports, say): record an event for it, add a named `RateLimit` next to the others, and call `enforceRateLimit` where the event is written.

**Owner step: Cloudflare rate-limiting rule on the auth routes.** It cannot be created from code, and the tests never touch Cloudflare. In the Cloudflare dashboard, for the `mesaaberta.app` zone, open Security > WAF > Rate limiting rules > Create rule:

- **Name:** `auth routes`
- **If incoming requests match** (Edit expression):

  ```
  (http.request.method eq "POST" and http.request.uri.path in {"/login" "/signup" "/forgot" "/reset" "/forgot-password" "/reset-password"})
  or http.request.uri.path eq "/auth/callback"
  or starts_with(http.request.uri.path, "/login/")
  ```

  The last two are the `GET`s that finish a sign-in and start a social one; `POST /logout` is left out.

- **Counting characteristic:** IP
- **Threshold and period:** 10 requests per 1 minute. The Free plan only offers a 10 second period: use 5 requests per 10 seconds there.
- **Action:** Block for 10 minutes (on the Free plan, the 10 seconds it allows), with a custom response: status `429`, content type `text/plain`, body `Muitas tentativas. Tente de novo em alguns minutos.`

The available periods, durations and the number of rules depend on the plan; check them on the plan you have. Supabase Auth also has limits of its own on sign-ins and emails.

## Logging and observability

Sentry is the only external application-log and exception destination. Workers Logs remains the
edge-local JSON destination. The server hook uses the SDK's Cloudflare request-scoped
initialization, and the background Worker uses `@sentry/cloudflare`. The web app reports to the
project in `PUBLIC_SENTRY_DSN` (blank: nothing is sent) and, when `PUBLIC_SENTRY_ORIGIN` is set,
only from that origin, so preview URLs stay quiet. The build adds `CSP_EXTRA_CONNECT_SRC` (that
project's ingest origin, `https://oNNN.ingest.us.sentry.io`) to the page's `connect-src`; without
it the browser blocks its own reports. Local development, Vitest and browser E2E do not send
telemetry. Tracing and Session Replay are disabled.

Use `locals.log` during a request, and pass it through background dispatches. The Cron creates its
own correlation ID. Messages must be static descriptions of operations, never user input:

```ts
locals.log.info('event.handler.succeeded', {
  event: 'event.handler.succeeded',
  eventId,
  handler: 'mixpanel-product-events-v1',
  attempt: 1,
  durationMs: 42,
});
```

Every console line has `schemaVersion`, `time` (UTC ISO timestamp), `level`, `msg` and `service`.
Request logs add the Cloudflare `cf-ray` as `requestId` (a UUID locally), `environment`, Worker
version `release`, method, **route template** (for example `/t/[slug]`), status, outcome and
duration. Raw paths and query strings are not recorded. The web Worker passes its `requestId` to
the api in `x-request-id`, so the api's lines carry the same id, and each worker run (cron or queue
delivery) has its own. Field names are camelCase: `requestId` for the request or run a line belongs
to, `actionId` for the request that recorded an event. Dispatcher logs add event ID/type, the
event's `actionId`, handler, attempt and duration. Failed handlers produce `event.handler.failed`, followed by
`event.retry.scheduled` with `retryInSeconds`, or `event.exhausted` after eight attempts.

**Privacy boundary:** `src/lib/observability/privacy.ts` defines the allowed operational fields.
Unknown fields, nested objects, user identity, form data, headers, cookies, session IDs and payloads
are dropped **before both destinations**. Strings have an additional credential/email scrubber.
Errors contribute only their type and safe error code to logs; caught operational errors and
unexpected SvelteKit errors produce Sentry issues with code locations and safe correlation tags.
The Sentry `beforeSend` callback reconstructs exceptions without messages, request data, user data,
breadcrumbs, source context or local variables. `beforeSendLog` independently filters SDK-added
attributes and rejects automatic console logs. Do not add console-capture integrations.
Performance traces (`TRACES_SAMPLE_RATE` in `packages/core/src/observability/sentry-options.ts`,
100% for now) pass `beforeSendTransaction` and `beforeSendSpan`, which keep the route, timings, Web
Vitals and span operations, and drop request and user data, query strings, SQL literals and span
attributes outside an allowlist.

To investigate a failure, filter Sentry Logs by `requestId`, find the failed operation and error code,
then find its issue with the same tag. To follow one action end to end (web, api, then the worker's
handlers), filter by `requestId` or `actionId` being that id. For background work, filter by `eventId`: find the failed
handler, its next retry and eventual success/exhaustion. Use `release` to identify the deployed
Worker. The console transport uses the same IDs. Telemetry failure never changes the application's
result; SDK flushing runs under the Worker's execution context.

Source maps use the wizard's git-ignored `.env.sentry-build-plugin` locally, or `SENTRY_AUTH_TOKEN`
in the build environment, and go to the project named by `SENTRY_ORG` and `SENTRY_PROJECT`. Never put this auth token in Wrangler vars or browser code. Upload is
skipped when neither source is configured. Sentry's DSN is public and is included in the SDK
configuration. Source-map debug IDs are preserved after privacy filtering.

Retention of Workers Logs and Sentry data is controlled by their project/account settings, **not**
by the domain-event sweeper. Review the current provider retention in the dashboards and use the
shortest operational window your plan supports; do not assume domain events' 90-day retention
applies to telemetry. The Sentry project does not receive account identities.

### Uptime

The Sentry Uptime Monitor has been configured in `mesa-aberta-app` for **GET
`https://mesaaberta.app/healthz`**, expecting HTTP 200, with the header `Authorization: Bearer
<HEALTHZ_TOKEN>` and no request body. Use the project's free monitor allocation and set an alert
recipient in Sentry. The monitor was created through the Sentry interface; the wizard token is
restricted to build operations and does not grant monitor administration.

`/healthz` answers only to that bearer token (`HEALTHZ_TOKEN`, a Worker secret kept in Infisical
under `/runtime`; the deploy gate sends it too). Anyone else gets a 401 that touches neither the
database nor the api, and with no token configured nobody gets in. With the token it returns
`status` and `database`, HTTP 503 when the configured database cannot answer, the build each app
runs (`version`, `revision`), the api's state and latency and the background Worker's last sweep. It
disables caching. A deployment without a configured database returns `database: "not_configured"`;
verify production reports `ok` when setting up the monitor. After a release:

```sh
curl -s -H "authorization: Bearer $HEALTHZ_TOKEN" https://mesaaberta.app/healthz
```

### Product analytics

Cloudflare Web Analytics is already enabled through Cloudflare's automatic site integration.
The CSP permits `static.cloudflareinsights.com` and `cloudflareinsights.com`; the application does
not install a second beacon or a browser Mixpanel SDK.

Product events go through a provider-neutral interface in `src/lib/server/analytics/`. The privacy
filter (`product-events.ts`) turns a domain event into an `AnalyticsEvent`, and each provider is an
adapter implementing `AnalyticsProvider` (`provider.ts`). To add or swap a provider, write an
adapter, add its environment variables to `AnalyticsEnv` and list its factory in `index.ts`; every
configured provider gets its own outbox handler named `<provider>-product-events-v1`, so they retry
independently. Nothing outside this folder knows which vendor is in use.

Mixpanel is the first adapter and runs server-side through `mixpanel-product-events-v1` in the existing outbox. Set
`MIXPANEL_TOKEN` with `wrangler secret put MIXPANEL_TOKEN`. `MIXPANEL_REGION` can be `US` (default),
`EU` or `IN`, matching the Mixpanel project. Without a token the handler is disabled; enabling it
does not replay already-processed historical events.

Only `TableCreated`, `TableUpdated`, `TableDisabled`, `JoinRequested`, `JoinApproved`,
`JoinDeclined`, `PlayerJoined`, `PlayerLeft` and `RatingSubmitted` are forwarded. Properties are
limited to the actor's opaque UUID (`distinct_id`), event UUID (`$insert_id`), original timestamp
and table UUID. No email, name, slug, table text, rating/comment, IP or connection event is sent.
No identity profiles or browser cookies are created. The Import API accepts the token as Basic auth
with an empty password; it allows delayed outbox retries without the Track API's five-day limit.

Each import has a five-second timeout and verifies the provider's acknowledgement. Failed imports
retry through the existing outbox and do not repeat handlers that already succeeded. The same
`$insert_id`, actor, type and original timestamp deduplicate ambiguous network failures. Response
bodies are never copied into error messages. No analytics failure rolls back a player's action.

#### Product event taxonomy

The ten events of the product plan (Trello #155) are sent through the same providers. Two paths,
both server-side, opaque ids only, no cookies:

| Event                                  | Source                                                                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gm_mesa_created`, `gm_mesa_published` | `TableCreated` in the outbox (a mesa has no draft step: creating it publishes it). `seats_initial_count` is the table's capacity.                                                                                                             |
| `player_seat_claimed`                  | `PlayerJoined` (`claim_status: success`) and `JoinRequested` (`pending_approval`) in the outbox.                                                                                                                                              |
| `player_browse_mesas_viewed`           | `/tables` load. `page_context` is `search_results` when a filter is set, else `browse_feed`; `source_channel` comes from the Referer (`direct`, `internal_link`, `referral`). Sent once per page view with `result_count`, not once per mesa. |
| `player_mesa_detail_viewed`            | `/t/[slug]` load: `mesa_id`, `gm_user_id`, `seat_availability`.                                                                                                                                                                               |
| `player_seat_claim_initiated`          | the `join` action, before it succeeds or fails: `mesa_id`, `player_user_id`, `seat_claim_method: button_click`.                                                                                                                               |
| `gm_onboarding_started`                | `/u/profile/setup` (`profile_setup`) and `/tables/new` (`table_setup_start`) loads; `country_market` is `BR`.                                                                                                                                 |

Outbox events keep retries and `$insert_id` deduplication. Request events go through
`locals.track(name, userId, properties)`, which sends after the response, is best effort (a failure
is logged as `analytics.track.failed`, never retried) and skips anonymous visitors, since there is
no opaque id and no cookie to make one. Every event carries `timestamp_utc`.

Not implemented: `calendar_invite_sent`, `calendar_invite_accepted` and `player_calendar_invite_declined`.
The invite mail is sent by the invite handler, which does not record a domain event, and a calendar
reply goes to the player's calendar app, never back to the application. They need an `InviteSent`
domain event and an inbound-reply source first.

### Business metrics from SQL

These read-only queries count recorded business activity, irrespective of external delivery.
They use São Paulo calendar weeks. The sweeper deletes completed ordinary events after 90 days,
so the queries deliberately cover eight weeks; they are not lifetime totals. Confirmed joins count
`PlayerJoined` (automatic) and `JoinApproved` (manual), never `JoinRequested`. Rating submissions
include edits; the distinct actor/table count identifies how many pairs submitted in each week.

```sql
WITH weeks AS (
  SELECT generate_series(
    date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') - interval '7 weeks',
    date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo'),
    interval '1 week'
  ) AS week
), activity AS (
  SELECT date_trunc('week', created_at AT TIME ZONE 'America/Sao_Paulo') AS week,
    count(*) FILTER (WHERE type = 'TableCreated') AS tables_created,
    count(*) FILTER (WHERE type IN ('PlayerJoined', 'JoinApproved')) AS confirmed_joins,
    count(*) FILTER (WHERE type = 'RatingSubmitted') AS rating_submissions,
    count(DISTINCT (actor_id, payload->>'tableId'))
      FILTER (WHERE type = 'RatingSubmitted') AS rating_pairs
  FROM events
  WHERE created_at >= (
    date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') - interval '7 weeks'
  ) AT TIME ZONE 'America/Sao_Paulo'
  GROUP BY 1
)
SELECT weeks.week::date,
  coalesce(tables_created, 0) AS tables_created,
  coalesce(confirmed_joins, 0) AS confirmed_joins,
  coalesce(rating_submissions, 0) AS rating_submissions,
  coalesce(rating_pairs, 0) AS rating_pairs
FROM weeks LEFT JOIN activity USING (week)
ORDER BY weeks.week;
```

Check delivery health separately, without selecting event payloads or exception text:

```sql
SELECT type,
  count(*) FILTER (WHERE processed_at IS NULL AND failed_at IS NULL) AS pending,
  count(*) FILTER (WHERE failed_at IS NOT NULL) AS exhausted,
  min(next_attempt_at) FILTER (WHERE processed_at IS NULL AND failed_at IS NULL) AS next_retry
FROM events
GROUP BY type
ORDER BY type;
```

## Security headers

`src/lib/server/security-headers.ts` adds `X-Content-Type-Options`, `Referrer-Policy` and `Strict-Transport-Security` to every response. The `Content-Security-Policy` is set by SvelteKit (`kit.csp` in `vite.config.ts`) with a fresh nonce per response, and forbids framing (`frame-ancestors 'none'`). SvelteKit's CSRF origin check stays on; `e2e/security.e2e.ts` proves it.

Because inline styles are blocked, do not write `style="..."` in markup: use a class, or a `data-` attribute that CSS selects on. `e2e/security.e2e.ts` fails on any CSP violation, so a blocked style or script shows up in CI.

`GET /healthz` reports application and database health for uptime checks, to holders of its bearer token only (see Observability).

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

## API query architecture

See [API queries](docs/api-queries.md) for cache boundaries, SSR hydration, form ownership and the ViaCEP flow.

The catalog, approval queue and notification actions use TanStack Form with TanStack Query mutations. Shared form helpers preserve typed values on failure, block duplicate submissions, do not retry writes, and refresh affected reads only after success. All forms share this contract. Compound fields use writable bindings backed by TanStack Form; query refetches never replace edited drafts. See [Contributing](CONTRIBUTING.md#ui-and-forms) for the contract.

## Private extensions

Features that are not open source (the Instagram connector today) are extensions, injected at build
time by the owner's private pipeline. They plug into one seam, `Extension` in
`packages/core/src/server/extensions/contract.ts`, listed in `installed.ts` (empty in this repository), with
their admin panels in `apps/web/src/lib/extensions/panels.ts` and the origins their connection forms post to
in `origins.ts`. `packages/privy/` is the placeholder the private package is checked out into.

This project builds and runs without them: no connector is installed, `SOCIAL_PROVIDER=none` is the
effective default, the admin tables page shows no post column or filter, and `/admin/<extension>`
and `/<extension>/assets/...` answer 404. The tables behind a connector (`instagram_accounts`,
`instagram_posts`) stay in the schema so a private build can use them.

### Badge backfill

`bun run badges:backfill [--apply] [--pioneer-before=YYYY-MM-DD]` gives existing members the badges their history already earned. It points at whatever `DATABASE_URL` says, so check that first. Without `--apply` it only prints how many members would get each badge. It records no `BadgeEarned` event, so nobody is notified, and it is safe to run again: a held or revoked badge is left as it is. `--pioneer-before` also gives the Pioneiro to everyone who joined before that date (the release day); leave it out to give none. Active accounts that finished onboarding are the only ones looked at. Backfilled rows have no source event and carry the time of the run as `awarded_at`.

### Daily RPG crowdfunding imports

The Worker discovers new tabletop RPG campaigns from Catarse and Meeplestarter at **01:00 America/Sao_Paulo** (`0 4 * * *`, UTC). The background Worker (`apps/worker`) dispatches this independently from the existing five-minute event sweeper. The production Wrangler configuration enables it; set `CROWDFUNDING_IMPORT_ENABLED=false` to pause discovery without deleting campaigns or import history. With no database binding or without the flag set to `true`, discovery does nothing.

Adapters read Catarse's full paginated Jogos community discovery (`category=2&filterBy=popular`), rather than the recent-launch subset, its public Next.js campaign records, and Meeplestarter's public RPG listing at `mail.meeplestarter.com.br`. The latter is a published hostname serving the same campaign IDs and dates; imported links open the canonical `meeplestarter.com.br` campaign. They require tabletop RPG product evidence in the campaign (including character-creation/GM/dice mechanics or the campaign’s own player/rulebook rewards), complete published dates and a current campaign. Broad games categories, recurring subscriptions, ended/cancelled campaigns and ambiguous descriptions are skipped. The first run includes currently active campaigns. Upcoming campaigns require both dates. Image-only descriptions can remain unclassified; the existing member submission flow is still available.

Accepted entries appear immediately with automatic-source credit and use existing reports/admin removal. Source IDs and verified URL aliases prevent duplicate imports, including campaigns shared by a member. Removed campaigns stay suppressed whenever their known source identity or normalized URL matches; a removed legacy member link with an unknown source ID and a changed slug cannot be matched until its identity is known. Existing entries and member attribution are never overwritten. Campaign status continues to be derived from dates.

Per-source/date leases prevent overlapping work and fence stale checkpoints. Each source gets four minutes, at most 20 listing pages and 150 campaign-detail reads, with sequential processing and a persisted next-candidate cursor. Caps are recorded as `partial` and resume on the next daily run. Source failures are isolated and recorded as `failed`, retaining the cursor. Missing/deleted campaign detail pages (404/410) are skipped and checkpointed so they cannot block later campaigns; listing failures still fail the source. A blocked page or changed schema is not a successful empty scan. At most two transient fetch retries share a 15-second deadline that includes response-body consumption. Short-lived campaigns between daily scans cannot be guaranteed discovery.

Run `bun run crowdfunding:dry-run [all|catarse|meeplestarter]` to use the production readers/parsers without database writes, events or image uploads. Normal imports copy images to the existing Supabase images bucket using the configured server secret (`SUPABASE_SECRET_KEY`, legacy `SUPABASE_SERVICE_ROLE_KEY` also supported); images fall back to the standard tile if storage is unavailable. No new public endpoint or privileged key is exposed.

Inspect `crowdfunding_import_runs` for status, counters, sanitized failure codes and continuation cursors. Structured `crowdfunding source import` logs include source, run token, duration and imported/existing/suppressed/skipped counts. For a local scheduled smoke test after building, use Wrangler's `/cdn-cgi/local/scheduled?cron=0+4+*+*+*` route. Source-only discovery was also verified with local workerd against both live sites. Before production rollout, apply the generated migration through the normal deployment pipeline; after deployment check the registered trigger and first daily run. Pause with the flag if a source changes its format.

### Consent-based player invitations

A GM can invite an existing, active player by exact @username. A pending invitation reserves a seat until the earlier of 48 hours and the session start. The recipient must sign in to the matching account and choose accept or decline by POST. GET links never decide an invitation. Acceptance exchanges the reservation for a confirmed registration and sends the normal calendar/welcome message once. A decline prevents another invitation for that table; voluntary registration stays available. A player can disable invitations globally or block invitations from a GM in their private profile settings. Both cancel applicable pending invitations without removing confirmed registrations. Relevant schedule/location edits and account/table closure cancel pending invitations too.

`RESEND_TEMPLATE_PLAYER_INVITATION` is optional and uses the `mesaaberta-player-invitation` template prepared by `bun run resend:templates`. It receives `RECIPIENT_NAME`, `TABLE_TITLE`, `TABLE_URL` (the authenticated decision page), `CONTEXT=PLAYER_INVITATION`, `STARTS_AT`, `FALLBACK_TEXT`, `GM_NAME`, and `EXPIRES_AT`. Publish the template with fallbacks before setting the variable. With no template id the handler sends inline HTML/text. The handler rechecks eligibility at dispatch and uses event/recipient idempotency. No invitation contains private location, access link, or welcome message. No automatic resends run. Initial GM issue limits are 5/minute and 20/24h. Preferences, blocks and invitation history are private and included in account export/deletion.
