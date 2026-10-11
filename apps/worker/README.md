# @mesaaberta/worker

The background Worker of Trello #120: Cron Triggers today, the Queues consumer later. It runs the
event-delivery graph from `@mesaaberta/core`, the same code the web Worker's `scheduled` handler runs.

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

## Queues consumer (shadow)

`queue()` acknowledges and counts every message and runs no handler (ADR 0003, stage 2). The queues
`domain-events-canary` and `domain-events-canary-dlq` exist; this Worker's config declares the
consumer, which attaches when the Worker is deployed (a queue has one consumer). The web Worker holds
the producer binding `DOMAIN_EVENTS` and publishes only for people targeted by the flag
`api_events_queue_shadow`, which has no rules yet. Live delivery swaps the executor for
`createEventExecutor`, one event class at a time.

## Error reporting

`src/entry.ts` wraps the handler with `@sentry/cloudflare` and installs the same telemetry sink as the
web app. The privacy policy (`privateSentryOptions`) is shared through `@mesaaberta/core`. `SENTRY_DSN`
is a Worker var; unset, Sentry stays off and logs still reach the console.
