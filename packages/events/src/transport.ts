/**
 * Delivery of events to the code that reacts to them. The outbox row stays the truth; a transport
 * only carries a small versioned reference to it, at least once, so a consumer reads the row and
 * must be idempotent. Cloudflare Queues and a Postgres poller are adapters of this one contract.
 */

/** Event versions a consumer in this build can read. A reference outside it is not retried. */
export const SUPPORTED_EVENT_VERSIONS: readonly number[] = [1];

/** What travels on the transport: ids only, never the payload or anything private. */
export type JobRef = {
  eventId: string;
  type: string;
  version: number;
};

/**
 * What an executor reports for one delivery. Only an explicit outcome acknowledges a message: the
 * legacy dispatcher swallows handler failures and returns normally, which must never read as done.
 */
export type JobOutcome =
  | { status: 'done' }
  /** Try again, not before `afterSeconds`. */
  | { status: 'retry'; afterSeconds: number; reason: string }
  /** Given up on: it stays in the outbox for a person to look at (the dead-letter path). */
  | { status: 'failed'; reason: string };

export type JobExecutor = (ref: JobRef) => Promise<JobOutcome>;

/** The producer side of a transport. Accepting a reference says nothing about its effects. */
export interface JobTransport {
  enqueue(ref: JobRef, options?: { delaySeconds?: number }): Promise<void>;
}

/** The delivery's own metadata, which the transport tracks and the executor never sees. */
export type Delivery = { attempt: number };

/**
 * Runs one delivery and decides what the transport does with it. An executor that throws is a
 * retry, and an unsupported version is a failure, not a retry loop.
 */
export async function settle(
  ref: JobRef,
  executor: JobExecutor,
  {
    attempt,
    maxAttempts,
    backoffSeconds,
  }: Delivery & {
    maxAttempts: number;
    backoffSeconds: (attempt: number) => number;
  },
): Promise<JobOutcome> {
  if (!SUPPORTED_EVENT_VERSIONS.includes(ref.version)) {
    return { status: 'failed', reason: `unsupported event version ${ref.version}` };
  }

  let outcome: JobOutcome;
  try {
    outcome = await executor(ref);
  } catch (error) {
    outcome = {
      status: 'retry',
      afterSeconds: backoffSeconds(attempt),
      reason: error instanceof Error ? error.name : 'unknown error',
    };
  }

  if (outcome.status === 'retry' && attempt >= maxAttempts) {
    return { status: 'failed', reason: `gave up after ${attempt} attempts: ${outcome.reason}` };
  }
  return outcome;
}
