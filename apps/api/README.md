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
`messages`, behind `api_account`; the subject is always the actor). It has no public route and no
cron. The web Worker reaches it through a Service Binding (`API`), sending the signed-in admin's id
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
