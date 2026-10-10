import type { JobExecutor } from '@mesaaberta/events';
import type { AnyDb } from '../db/client';
import type { Logger } from '../logger';
import { dispatchEvent, type DispatchOptions } from './dispatcher';
import type { Handler } from './types';

/** Seconds to wait before a delivery that found the event held by someone else comes again. */
const BUSY_RETRY_SECONDS = 30;

/**
 * Adapts the handler dispatcher to the transport's executor contract (ADR 0003): one delivery of
 * an event reference runs the handlers that have not succeeded and reports an explicit outcome.
 * A queue acknowledges only on `done` or `failed`; `retry` redelivers after the delay.
 *
 * The outbox row stays the truth: a duplicate delivery of a processed event is a `done`, and a
 * delivery that finds the lease held is a short retry, never a second run.
 */
export function createEventExecutor(
  db: AnyDb,
  handlers: readonly Handler[],
  { log, options = {} }: { log: Logger; options?: DispatchOptions },
): JobExecutor {
  return async ({ eventId }) => {
    const result = await dispatchEvent(db, handlers, eventId, new Date(), log, {
      clock: () => new Date(),
      ...options,
    });

    switch (result.status) {
      case 'done':
        return { status: 'done' };
      case 'retry':
        return { status: 'retry', afterSeconds: result.retryInSeconds, reason: result.reason };
      case 'failed':
        return { status: 'failed', reason: result.reason };
      case 'lost':
        return { status: 'retry', afterSeconds: BUSY_RETRY_SECONDS, reason: 'lease lost' };
      case 'skipped':
        switch (result.reason) {
          case 'processed':
            return { status: 'done' };
          case 'given_up':
            return { status: 'failed', reason: 'given up after the attempt cap' };
          case 'missing':
            return { status: 'failed', reason: 'event not found' };
          case 'busy':
            return {
              status: 'retry',
              afterSeconds: BUSY_RETRY_SECONDS,
              reason: 'held by another dispatcher',
            };
        }
    }
  };
}
