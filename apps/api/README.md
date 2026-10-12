# @mesaaberta/api

The api app of Trello #120: a Hono app that will own writes, policies and the outbox, one route at a
time, behind `api_<area>` GrowthBook flags (strangler; the web app stays the default path).

**Status: first route written, not deployed.** It answers `/healthz` and the admin event actions
(`POST /v1/admin/events/:id/force`, `POST /v1/admin/events/retry-failed`). It has no public route and
no cron. The web Worker reaches it through a Service Binding (`API`), sending the signed-in admin's id
in `x-actor-id`; the api checks that person is an active admin in the database again. On web the
actions only call it when `api_admin_events` is on for the admin and the binding exists, and fall back
to the in-process path when the call fails. The api Worker needs the same database binding and
secrets as the other Workers, set by the private deployment.

## Moving a route (the rule)

1. Put the domain logic in `@mesaaberta/core` (runtime-neutral, no SvelteKit imports).
2. Add the Hono route here; keep the web form action as the default path.
3. Behind `api_<area>` (default off), the form action calls the api instead; admins first.
4. Roll back by turning the flag off.

Run `bun run --bun vitest run --project server apps/api`.
