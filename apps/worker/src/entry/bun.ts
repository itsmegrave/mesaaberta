import { createWorker, type WorkerEnv } from '../index';
import { connectionStringFrom, createDb } from '@mesaaberta/core/server/db/client';
import { outboxDepth } from '@mesaaberta/core/server/events/outbox-depth';
import { SWEEPER_CRON } from '@mesaaberta/core/server/events/scheduled';
import { setHandlerObserver } from '@mesaaberta/core/server/events/handler-runs';
import { logInstalled } from '@mesaaberta/core/server/extensions/observe';
import { setAppName } from '@mesaaberta/core/server/logger';
import { createJobMetrics } from '@mesaaberta/core/server/metrics';
import { createScheduler } from '../scheduler';

// The background worker on Bun, for a self-hosted deployment (Docker): the same handler the Cloudflare
// Worker runs from its Cron Triggers, called by a small in-process scheduler (see scheduler.ts). It
// has no public surface and no queue: events are swept from the Postgres outbox, set
// `EVENT_POLLER=true` to sweep through the poller contract (ADR 0003).
setAppName('worker');
logInstalled();
const env = process.env as unknown as WorkerEnv;
const worker = createWorker();
const sweepEverySeconds = Math.max(30, Number(process.env.SWEEP_INTERVAL_SECONDS ?? 300));

const metrics = createJobMetrics('worker');
setHandlerObserver(metrics.observeHandler);

// The outbox is read once per sweep, not per scrape: a count over `events` is cheap, but a
// scraper's interval is not ours to decide. A failed read keeps the last numbers.
const connectionString = connectionStringFrom(env);
const readOutbox = async () => {
  if (!connectionString) return;
  const { db, close } = createDb(connectionString);
  try {
    metrics.setOutbox(await outboxDepth(db));
  } catch (error) {
    console.error('outbox read failed', error);
  } finally {
    await close().catch(() => undefined);
  }
};
const scheduler = createScheduler(
  async (cron, scheduledTime) => {
    const started = performance.now();
    let ok = true;
    try {
      await worker.scheduled({ cron, scheduledTime }, env);
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      if (cron === SWEEPER_CRON) await readOutbox();
      metrics.observe({
        job: cron,
        ok,
        seconds: (performance.now() - started) / 1000,
        at: new Date(),
      });
    }
  },
  { sweepEverySeconds },
);

// The only thing the worker listens on: its numbers, for a scraper on the Docker network.
Bun.serve({
  port: Number(process.env.METRICS_PORT ?? 9464),
  fetch: (request) =>
    new URL(request.url).pathname === '/metrics'
      ? new Response(metrics.render(), {
          headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
        })
      : new Response('Not found', { status: 404 }),
});

console.log(`worker started: sweeping every ${sweepEverySeconds}s, daily import from 04:00 UTC`);
const loop = () => scheduler.tick().catch((error) => console.error('scheduler tick failed', error));
void loop();
setInterval(loop, 5_000);

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => process.exit(0));
