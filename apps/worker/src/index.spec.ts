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
});
