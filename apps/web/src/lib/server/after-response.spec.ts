import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handleAfterResponse } from './after-response';

const run = async (body: (event: RequestEvent) => void, withHost = true) => {
  const waiting: Promise<unknown>[] = [];
  const log = { error: vi.fn() };
  const event = {
    locals: { log, host: withHost ? { waitUntil: (p: Promise<unknown>) => waiting.push(p) } : {} },
  } as unknown as RequestEvent;
  const order: string[] = [];
  await handleAfterResponse({
    event,
    resolve: async () => {
      body(event);
      order.push('response');
      return new Response();
    },
  });
  await Promise.all(waiting);
  return { log, waiting, order };
};

describe('handleAfterResponse', () => {
  it('runs the tasks after the response, on the host', async () => {
    const ran = vi.fn();
    const { waiting } = await run((event) => event.locals.afterResponse(async () => ran()));
    expect(ran).toHaveBeenCalledOnce();
    expect(waiting).toHaveLength(1);
  });

  it('waits nothing on the host when no task was queued', async () => {
    const { waiting } = await run(() => {});
    expect(waiting).toHaveLength(0);
  });

  it('awaits the tasks itself on a host without waitUntil', async () => {
    const ran = vi.fn();
    await run((event) => event.locals.afterResponse(async () => ran()), false);
    expect(ran).toHaveBeenCalledOnce();
  });

  it('logs a failing task instead of throwing, and still runs the others', async () => {
    const ran = vi.fn();
    const { log } = await run((event) => {
      event.locals.afterResponse(async () => {
        throw new Error('boom');
      });
      event.locals.afterResponse(async () => ran());
    });
    expect(ran).toHaveBeenCalledOnce();
    expect(log.error).toHaveBeenCalledOnce();
  });
});
