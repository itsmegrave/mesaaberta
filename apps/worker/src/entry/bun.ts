import { createWorker, type WorkerEnv } from '../index';
import { createScheduler } from '../scheduler';

// The background worker on Bun, for a self-hosted deployment (Docker): the same handler the Cloudflare
// Worker runs from its Cron Triggers, called by a small in-process scheduler (see scheduler.ts). It
// has no public surface and no queue: events are swept from the Postgres outbox, set
// `EVENT_POLLER=true` to sweep through the poller contract (ADR 0003).
const env = process.env as unknown as WorkerEnv;
const worker = createWorker();
const sweepEverySeconds = Math.max(30, Number(process.env.SWEEP_INTERVAL_SECONDS ?? 300));

const scheduler = createScheduler(
  (cron, scheduledTime) => worker.scheduled({ cron, scheduledTime }, env),
  { sweepEverySeconds },
);

console.log(`worker started: sweeping every ${sweepEverySeconds}s, daily import from 04:00 UTC`);
const loop = () => scheduler.tick().catch((error) => console.error('scheduler tick failed', error));
void loop();
setInterval(loop, 5_000);

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => process.exit(0));
