# @mesaaberta/worker

The background Worker of Trello #120: Cron Triggers today, the Queues consumer later. It runs the
event-delivery graph from `@mesaaberta/core`, the same code the web Worker's `scheduled` handler runs.

**Status: inert.** It is not deployed, has no crons and no routes. The web Worker still owns both
crons and `EVENT_POLLER` is off.

## Cutover (one step, after the private repo can deploy it)

1. Deploy this Worker from the private repo with its secrets (database, Instagram, Resend).
2. In one change, empty `triggers.crons` on the web Worker and set the two crons here.
3. Watch `event sweep` lines and the Sentry-free logs for one daily import and a day of sweeps.

Rollback is the reverse: crons back on the web Worker, then delete this Worker.

## Before it takes the crons

- Error reporting: this Worker logs to the console and Workers observability only. The Sentry
  telemetry sink needs the Sentry-specific privacy helpers moved out of the web app first.
