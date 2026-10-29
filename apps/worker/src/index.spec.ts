import { describe, expect, it, vi } from 'vitest';
import { createWorker, type WorkerEnv } from './index';

const env = { CF_VERSION_METADATA: { id: 'v1' } } as WorkerEnv;
const controller = { cron: '*/5 * * * *', scheduledTime: 0 };

describe('worker', () => {
  it('hands the trigger and a release-stamped logger to the scheduled runner', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await createWorker(run).scheduled(controller, env);
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toBe(controller);
    expect(run.mock.calls[0][1]).toBe(env);
    expect(run.mock.calls[0][2].log).toBeDefined();
  });

  it('does not throw when the run fails, so one bad run never poisons the next', async () => {
    const run = vi.fn().mockRejectedValue(new Error('boom'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createWorker(run).scheduled(controller, env)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('checks in each known job with its monitor once the monitors are on', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const monitor = vi.fn((_job, work: () => Promise<unknown>) => work());
    const worker = createWorker(run, undefined, monitor as never);

    await worker.scheduled(controller, env);
    expect(monitor).not.toHaveBeenCalled();

    const on = { ...env, SENTRY_CRON_MONITORS: 'true' };
    await worker.scheduled(controller, on);
    await worker.scheduled({ cron: '0 4 * * *', scheduledTime: 0 }, on);
    await worker.scheduled({ cron: '1 2 * * *', scheduledTime: 0 }, on);
    expect(monitor.mock.calls.map(([job]) => job.slug)).toEqual([
      'worker-event-sweep',
      'worker-daily-import',
    ]);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('lets the monitor see a failed run before the failure is logged', async () => {
    const run = vi.fn().mockRejectedValue(new Error('boom'));
    const seen: unknown[] = [];
    const monitor = vi.fn(async (_job, work: () => Promise<unknown>) => {
      try {
        return await work();
      } catch (error) {
        seen.push(error);
        throw error;
      }
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await createWorker(run, undefined, monitor as never).scheduled(controller, {
      ...env,
      SENTRY_CRON_MONITORS: 'true',
    });
    error.mockRestore();
    expect(seen).toHaveLength(1);
  });

  it('answers every request with an empty 404', async () => {
    const response = createWorker().fetch();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('acknowledges every queued message in the shadow stage without running handlers', async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const messages = [
      { body: { eventId: 'e1', type: 'invite.created', version: 1 }, attempts: 1, ack, retry },
      { body: { eventId: 'e2', type: 'invite.created', version: 99 }, attempts: 1, ack, retry },
      { body: 'garbage', attempts: 1, ack, retry },
    ];
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await createWorker().queue({ messages });
    expect(ack).toHaveBeenCalledTimes(3);
    expect(retry).not.toHaveBeenCalled();
    info.mockRestore();
    warn.mockRestore();
  });

  it('stays in the shadow stage, without a database, until live handlers are named', async () => {
    const open = vi.fn();
    const ack = vi.fn();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const messages = [
      { body: { eventId: 'e1', type: 'x', version: 1 }, attempts: 1, ack, retry: vi.fn() },
    ];
    await createWorker(undefined, open).queue(
      { messages },
      { ...env, DATABASE_URL: 'postgres://x' },
    );
    await createWorker(undefined, open).queue(
      { messages },
      { ...env, QUEUE_LIVE_HANDLERS: ' , ', DATABASE_URL: 'postgres://x' },
    );
    // Named handlers without a database cannot run anything either.
    await createWorker(undefined, open).queue(
      { messages },
      { ...env, QUEUE_LIVE_HANDLERS: 'mixpanel-product-events-v1' },
    );
    expect(open).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(3);
    info.mockRestore();
  });

  it('runs the named handlers through the outbox and always closes the database', async () => {
    // An outbox with no such event: the claim matches nothing and the lookup finds no row.
    const none = { returning: async () => [], then: (ok: (rows: never[]) => void) => ok([]) };
    const chain = { set: () => chain, from: () => chain, where: () => none };
    const db = { update: () => chain, select: () => chain };
    const close = vi.fn(async () => {});
    const open = vi.fn(() => ({ db, close })) as never;
    const ack = vi.fn();
    const retry = vi.fn();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await createWorker(undefined, open).queue(
      {
        messages: [
          { body: { eventId: 'e1', type: 'TableCreated', version: 1 }, attempts: 1, ack, retry },
        ],
      },
      { ...env, QUEUE_LIVE_HANDLERS: 'mixpanel-product-events-v1', DATABASE_URL: 'postgres://x' },
    );

    expect(open).toHaveBeenCalledExactlyOnceWith('postgres://x');
    // A missing event is a terminal failure: acknowledged, never retried.
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    info.mockRestore();
    warn.mockRestore();
  });

  it('reports a dead letter with ids only and acknowledges it, without opening the database', async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const open = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await createWorker(undefined, open).queue(
      {
        queue: 'domain-events-canary-dlq',
        messages: [
          { body: { eventId: 'e1', type: 'invite.created', version: 1 }, attempts: 11, ack, retry },
        ],
      },
      { ...env, QUEUE_LIVE_HANDLERS: 'mixpanel-product-events-v1' },
    );
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).toContain('queue.dead_letter');
    error.mockRestore();
  });
});
