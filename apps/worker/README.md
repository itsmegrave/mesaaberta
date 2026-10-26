# @mesaaberta/worker

The background Worker of Trello #120: Cron Triggers today, the Queues consumer later. It runs the
event-delivery graph from `@mesaaberta/core`, the same code the web Worker dispatches with after a request.

**Status: owns the crons.** It has no routes. The web Worker's `triggers.crons` is empty, this
Worker runs the event sweep (`*/5 * * * *`) and the daily import (`0 4 * * *`), and `EVENT_POLLER`
is off.

## Cutover (done in one release)

1. The private repo deploys this Worker with its secrets (database, Instagram, Resend).
2. The same release empties `triggers.crons` on the web Worker and sets the two crons here.
3. Watch one `event sweep` line every five minutes, the daily import, the pending and failed counts
   on `/admin/events` and Sentry for `scheduled job failed`.

Rollback is the reverse: crons back on the web Worker (pin the previous release), then delete this
Worker.

## Queues consumer

The queues `domain-events-canary` and `domain-events-canary-dlq` exist; this Worker's config declares
the consumer, which attaches when the Worker is deployed (a queue has one consumer). The web Worker
holds the producer binding `DOMAIN_EVENTS`.

**Shadow (ADR 0003, stage 2), the default.** `queue()` acknowledges and counts every message, runs
no handler and does not open the database. The web Worker publishes a reference for the people
targeted by the flag `api_events_queue_shadow`.

**Live, one event class at a time (stage 3).** Two switches, both needed:

1. `QUEUE_LIVE_HANDLERS` on this Worker names the handlers the consumer runs for real, for example
   `mixpanel-product-events-v1`. It runs those and only those, with fenced leases.
2. A flag per class on the web Worker makes a request leave those handlers pending and publish the
   event's reference once its own handlers are done:

   | Flag                         | Handlers to name in `QUEUE_LIVE_HANDLERS`                                                                       |
   | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
   | `api_events_queue_analytics` | `mixpanel-product-events-v1`                                                                                    |
   | `api_events_queue_bell`      | `in-app-notifications-v1`, `system-announcements-v1`, `moderation-notifications-v1`, `catalog-notifications-v1` |
   | `api_events_queue_mail`      | `calendar-invites-v1`, `ban-mail-v1`                                                                            |

   With the bell or the mail on the queue, a notification or an e-mail leaves after the consumer's
   batch wait (`max_batch_timeout`, 5 s here) instead of right after the response. Resend
   deduplicates a repeated send for 24 hours only.

The outbox row stays the truth. With only the flag on, or when a message is lost, the event stays
due and the sweeper runs what is pending within five minutes. With only the variable on, messages
find nothing left to run. To stop: turn the flag off. Pending rows need no clean-up.

## Error reporting

`src/entry.ts` wraps the handler with `@sentry/cloudflare` and installs the same telemetry sink as the
web app. The privacy policy (`privateSentryOptions`) is shared through `@mesaaberta/core`. `SENTRY_DSN`
is a Worker var; unset, Sentry stays off and logs still reach the console.

## Alerts and runbook

**Cron monitors.** With `SENTRY_CRON_MONITORS=true` each run of the two crons sends Sentry a check-in
when it starts and when it ends (`checkInMonitor` in `src/sentry-monitor.ts`, which flushes the opening
check-in before the run so the closing one cannot overtake it). Sentry creates the monitors from the config in
`packages/core/src/server/events/monitors.ts` on the first check-in and opens an issue on the first
failed, missed or too-long run:

| Monitor               | Cron          | Missed after | Timeout |
| --------------------- | ------------- | ------------ | ------- |
| `worker-event-sweep`  | `*/5 * * * *` | 2 min        | 5 min   |
| `worker-daily-import` | `0 4 * * *`   | 15 min       | 30 min  |

Off by default, since turning it on creates two monitors in the Sentry project. The self-hosted
scheduler (`src/entry/bun.ts`) does not check in.

**Outbox delay.** After each sweep, `reportDelay` raises `event.backlog.delayed` (code
`outbox_delayed`, with `delayed` and `delaySeconds`) when events have been due for more than 15
minutes and still have not run. It needs no setting.

What to do:

- **Sweep missed** (no check-in): look at the Worker's Cron Triggers and recent deploys in the
  Cloudflare dashboard, and at `/healthz` with the `HEALTHZ_TOKEN` bearer token
  (`worker.lastRunAt`; see Uptime in the root README). A deploy that dropped `triggers.crons` stops
  every job; redeploy the pinned release.
- **Sweep failed or timed out**: filter Sentry logs by the run's `requestId` to find the step that
  threw (database, a handler, pruning). A database outage resolves itself: due events wait in the
  outbox and the next run picks them up.
- **Outbox delayed**: open `/admin/events` on the pending and retrying tabs. Many events of one type
  point at one handler; its `event.handler.failed` lines say why. A backlog of every type with no
  failures means the sweep (50 per run) is not keeping up.
- **Daily import failed or missed**: each source writes `crowdfunding source import` (or `...
failed`, with its `code`) and a row in `crowdfunding_import_runs`. A source that fails is recorded
  there and does not fail the run, so the monitor only sees a run that could not start or finish.
  A missed run waits for the next day's trigger.

## Self-hosting (Bun / Docker)

`src/entry/bun.ts` runs the same handler with an in-process scheduler (`src/scheduler.ts`) instead of
Cron Triggers: the sweeper every `SWEEP_INTERVAL_SECONDS` (default 300, minimum 30) and the daily
crowdfunding import once per UTC day from 04:00 (it also holds its own per-source, per-date lease, so
a restart or a second process cannot run it twice). Build from the repository root:
`docker build -f apps/worker/Dockerfile -t mesaaberta-worker .`. It has no port and no queue; it needs
`DATABASE_URL` and the settings the handlers use (mail, Auth, Instagram). `EVENT_POLLER=true` sweeps
through the Postgres poller contract (ADR 0003).
