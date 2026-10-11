import { describe, expect, it, vi } from 'vitest';
import {
  MAX_DELAY_SECONDS,
  createQueueConsumer,
  queueTransport,
  type QueueMessage,
} from './cloudflare-queues';
import type { JobExecutor, JobRef } from './transport';

const ref: JobRef = { eventId: 'e1', type: 'invite.created', version: 1 };

const message = (body: unknown, attempts = 1) => {
  const m = {
    body,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
  return m satisfies QueueMessage;
};

describe('queueTransport', () => {
  it('sends only the reference as JSON', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const leaky = { ...ref, payload: { email: 'ana@example.com' } } as JobRef;
    await queueTransport({ send }).enqueue(leaky);
    expect(send).toHaveBeenCalledWith(ref, { contentType: 'json' });
  });

  it('delays a message and clamps the delay to what Cloudflare accepts', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const transport = queueTransport({ send });
    await transport.enqueue(ref, { delaySeconds: 90.2 });
    await transport.enqueue(ref, { delaySeconds: 10 ** 9 });
    await transport.enqueue(ref, { delaySeconds: -5 });
    expect(send.mock.calls[0][1]).toEqual({ contentType: 'json', delaySeconds: 91 });
    expect(send.mock.calls[1][1]).toEqual({ contentType: 'json', delaySeconds: MAX_DELAY_SECONDS });
    expect(send.mock.calls[2][1]).toEqual({ contentType: 'json' });
  });

  it('lets a rejected send reach the caller, so the outbox row stays unpublished', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue down'));
    await expect(queueTransport({ send }).enqueue(ref)).rejects.toThrow('queue down');
  });
});

describe('createQueueConsumer', () => {
  const run = async (executor: JobExecutor, messages: QueueMessage[], options = {}) => {
    const onFailed = vi.fn();
    const consume = createQueueConsumer({ executor, onFailed, ...options });
    const summary = await consume({ messages });
    return { summary, onFailed };
  };

  it('acknowledges only a done outcome', async () => {
    const m = message(ref);
    const { summary } = await run(async () => ({ status: 'done' }), [m]);
    expect(m.ack).toHaveBeenCalledOnce();
    expect(m.retry).not.toHaveBeenCalled();
    expect(summary).toEqual({ done: 1, retried: 0, failed: 0 });
  });

  it('retries with the executor backoff, never acknowledging', async () => {
    const m = message(ref);
    await run(async () => ({ status: 'retry', afterSeconds: 45.5, reason: 'busy' }), [m]);
    expect(m.retry).toHaveBeenCalledWith({ delaySeconds: 46 });
    expect(m.ack).not.toHaveBeenCalled();
  });

  it('treats a throwing executor as a retry with exponential backoff by attempt', async () => {
    const first = message(ref, 1);
    const third = message(ref, 3);
    const boom: JobExecutor = async () => {
      throw new Error('db down');
    };
    await run(boom, [first, third]);
    expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(third.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
  });

  it('gives up at the attempt cap: acknowledged and reported, not retried forever', async () => {
    const m = message(ref, 8);
    const { summary, onFailed } = await run(
      async () => ({ status: 'retry', afterSeconds: 1, reason: 'busy' }),
      [m],
    );
    expect(m.ack).toHaveBeenCalledOnce();
    expect(m.retry).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledWith(ref, expect.stringContaining('gave up after 8 attempts'));
    expect(summary.failed).toBe(1);
  });

  it('fails an unsupported event version without calling the executor', async () => {
    const executor = vi.fn();
    const m = message({ ...ref, version: 99 });
    const { onFailed } = await run(executor, [m]);
    expect(executor).not.toHaveBeenCalled();
    expect(m.ack).toHaveBeenCalledOnce();
    expect(onFailed).toHaveBeenCalledWith(expect.anything(), 'unsupported event version 99');
  });

  it('acknowledges a malformed body instead of poisoning the batch', async () => {
    const executor = vi.fn().mockResolvedValue({ status: 'done' });
    const bad = [message(null), message('text'), message({ eventId: 1 })];
    const good = message(ref);
    const { summary, onFailed } = await run(executor, [...bad, good]);
    for (const m of bad) expect(m.ack).toHaveBeenCalledOnce();
    expect(good.ack).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({ done: 1, retried: 0, failed: 3 });
  });

  it('hands the executor the reference only, even when the body carries more', async () => {
    const executor = vi.fn().mockResolvedValue({ status: 'done' });
    await run(executor, [message({ ...ref, payload: { secret: 'x' } })]);
    expect(executor).toHaveBeenCalledWith(ref);
  });

  it('settles messages independently: one failure does not stop the rest', async () => {
    const executor: JobExecutor = async (r) =>
      r.eventId === 'bad' ? { status: 'failed', reason: 'rejected' } : { status: 'done' };
    const { summary } = await run(executor, [
      message({ ...ref, eventId: 'bad' }),
      message({ ...ref, eventId: 'ok' }),
    ]);
    expect(summary).toEqual({ done: 1, retried: 0, failed: 1 });
  });
});
