import { describe, expect, it, vi } from 'vitest';
import { createMemoryTransport } from './memory-transport';
import type { JobExecutor, JobRef } from './transport';

const ref = (overrides: Partial<JobRef> = {}): JobRef => ({
  eventId: 'event-1',
  type: 'TableCreated',
  version: 1,
  ...overrides,
});

describe('a job transport', () => {
  it('delivers a reference once and acknowledges an explicit done', async () => {
    const executor = vi.fn<JobExecutor>().mockResolvedValue({ status: 'done' });
    const bus = createMemoryTransport({ executor });

    await bus.transport.enqueue(ref());
    const outcomes = await bus.drain();

    expect(outcomes).toEqual([{ status: 'done' }]);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(bus.pending()).toBe(0);
  });

  it('redelivers a retry after its delay, not before', async () => {
    const executor = vi
      .fn<JobExecutor>()
      .mockResolvedValueOnce({ status: 'retry', afterSeconds: 60, reason: 'provider 503' })
      .mockResolvedValueOnce({ status: 'done' });
    const bus = createMemoryTransport({ executor });

    await bus.transport.enqueue(ref());
    await bus.drain();
    expect(bus.pending()).toBe(1);

    await bus.drain();
    expect(executor).toHaveBeenCalledTimes(1);

    bus.advance(60);
    await bus.drain();
    expect(executor).toHaveBeenCalledTimes(2);
    expect(bus.pending()).toBe(0);
  });

  it('treats a thrown error as a retry, never as done', async () => {
    const executor = vi
      .fn<JobExecutor>()
      .mockRejectedValueOnce(new TypeError('boom'))
      .mockResolvedValueOnce({ status: 'done' });
    const bus = createMemoryTransport({ executor, backoffSeconds: () => 30 });

    await bus.transport.enqueue(ref());
    const [first] = await bus.drain();

    expect(first).toMatchObject({ status: 'retry', afterSeconds: 30, reason: 'TypeError' });
    expect(bus.pending()).toBe(1);
  });

  it('dead-letters after the attempt cap, keeping why', async () => {
    const executor = vi
      .fn<JobExecutor>()
      .mockResolvedValue({ status: 'retry', afterSeconds: 1, reason: 'still failing' });
    const bus = createMemoryTransport({ executor, maxAttempts: 3 });

    await bus.transport.enqueue(ref());
    for (let attempt = 0; attempt < 3; attempt++) {
      await bus.drain();
      bus.advance(1);
    }

    expect(executor).toHaveBeenCalledTimes(3);
    expect(bus.pending()).toBe(0);
    expect(bus.deadLetters).toEqual([
      { ref: ref(), reason: 'gave up after 3 attempts: still failing' },
    ]);
  });

  it('does not retry a version it cannot read', async () => {
    const executor = vi.fn<JobExecutor>().mockResolvedValue({ status: 'done' });
    const bus = createMemoryTransport({ executor });

    await bus.transport.enqueue(ref({ version: 99 }));
    await bus.drain();

    expect(executor).not.toHaveBeenCalled();
    expect(bus.pending()).toBe(0);
    expect(bus.deadLetters[0].reason).toBe('unsupported event version 99');
  });

  it('allows the same reference twice, so an executor must be idempotent', async () => {
    const seen = new Set<string>();
    const executor: JobExecutor = async ({ eventId }) => {
      seen.add(eventId);
      return { status: 'done' };
    };
    const bus = createMemoryTransport({ executor });

    await bus.transport.enqueue(ref());
    await bus.transport.enqueue(ref());
    const outcomes = await bus.drain();

    expect(outcomes).toHaveLength(2);
    expect(seen.size).toBe(1);
  });
});
