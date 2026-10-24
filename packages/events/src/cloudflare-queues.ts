import {
  settle,
  type Delivery,
  type JobExecutor,
  type JobOutcome,
  type JobRef,
  type JobTransport,
} from './transport';

/**
 * The Cloudflare Queues adapter of the transport contract (ADR 0003). It knows the Queue binding
 * only through the two shapes below, so it runs, and is tested, without Cloudflare. A queue message
 * carries a `JobRef` and nothing else: the outbox row stays the truth.
 */

/** What `Queue.metrics()` reports (Cloudflare, April 2026): the backlog right now. */
export type QueueMetrics = {
  backlogCount: number;
  backlogBytes: number;
  /** Milliseconds since the epoch; empty or zero when the queue holds nothing. */
  oldestMessageTimestamp: number;
};

/** The producer binding (`env.DOMAIN_EVENTS`). */
export type QueueBinding = {
  send(message: JobRef, options?: { contentType?: 'json'; delaySeconds?: number }): Promise<void>;
  /** Absent on older runtimes and on the local simulator. */
  metrics?(): Promise<QueueMetrics>;
};

export type QueueBacklog = { count: number; bytes: number; oldest: Date | null };

/** The queue's backlog, or `null` when the binding cannot say. It never throws: it feeds a panel. */
export async function queueBacklog(queue: QueueBinding | undefined): Promise<QueueBacklog | null> {
  if (!queue?.metrics) return null;
  try {
    const metrics = await queue.metrics();
    return {
      count: metrics.backlogCount,
      bytes: metrics.backlogBytes,
      oldest:
        metrics.backlogCount > 0 && metrics.oldestMessageTimestamp > 0
          ? new Date(metrics.oldestMessageTimestamp)
          : null,
    };
  } catch {
    return null;
  }
}

/** Cloudflare caps a message delay at 12 hours. */
export const MAX_DELAY_SECONDS = 12 * 60 * 60;

export function queueTransport(queue: QueueBinding): JobTransport {
  return {
    async enqueue(ref, { delaySeconds = 0 } = {}) {
      const delay = Math.min(Math.max(0, Math.ceil(delaySeconds)), MAX_DELAY_SECONDS);
      // Only the reference travels, whatever object the caller passes in.
      const body: JobRef = { eventId: ref.eventId, type: ref.type, version: ref.version };
      await queue.send(
        body,
        delay > 0 ? { contentType: 'json', delaySeconds: delay } : { contentType: 'json' },
      );
    },
  };
}

/** One delivered message, as the consumer sees it (`MessageBatch.messages[n]`). */
export type QueueMessage = {
  body: unknown;
  /** Starts at 1 and counts every delivery, including redeliveries after a retry. */
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

export type QueueBatch = {
  /** The queue the batch was read from (`MessageBatch.queue`). */
  queue?: string;
  messages: readonly QueueMessage[];
};

const isRef = (body: unknown): body is JobRef => {
  if (!body || typeof body !== 'object') return false;
  const ref = body as Record<string, unknown>;
  return (
    typeof ref.eventId === 'string' &&
    ref.eventId.length > 0 &&
    typeof ref.type === 'string' &&
    Number.isInteger(ref.version)
  );
};

export type ConsumerSummary = { done: number; retried: number; failed: number };

/**
 * The batch handler for `queue(batch, env)`. Every message is settled on its own, so one bad message
 * never holds back the rest of its batch. Only an explicit outcome acknowledges a message; a
 * terminal failure is acknowledged too (the outbox row records it for a person to look at) and is
 * reported through `onFailed`, so the queue's dead-letter queue only receives what crashed.
 */
export function createQueueConsumer({
  executor,
  maxAttempts = 8,
  backoffSeconds = (attempt) => Math.min(30 * 2 ** (attempt - 1), MAX_DELAY_SECONDS),
  onFailed = () => {},
}: {
  executor: JobExecutor;
  maxAttempts?: number;
  backoffSeconds?: (attempt: number) => number;
  onFailed?: (ref: JobRef | null, reason: string) => void;
}) {
  const settleOne = async (message: QueueMessage): Promise<JobOutcome> => {
    if (!isRef(message.body)) {
      message.ack();
      const outcome: JobOutcome = { status: 'failed', reason: 'malformed message' };
      onFailed(null, outcome.reason);
      return outcome;
    }
    const ref: JobRef = {
      eventId: message.body.eventId,
      type: message.body.type,
      version: message.body.version,
    };
    const delivery: Delivery = { attempt: message.attempts };
    const outcome = await settle(ref, executor, { ...delivery, maxAttempts, backoffSeconds });
    if (outcome.status === 'retry') {
      message.retry({ delaySeconds: Math.min(Math.ceil(outcome.afterSeconds), MAX_DELAY_SECONDS) });
    } else {
      message.ack();
      if (outcome.status === 'failed') onFailed(ref, outcome.reason);
    }
    return outcome;
  };

  return async (batch: QueueBatch): Promise<ConsumerSummary> => {
    const summary: ConsumerSummary = { done: 0, retried: 0, failed: 0 };
    for (const message of batch.messages) {
      const outcome = await settleOne(message);
      if (outcome.status === 'done') summary.done += 1;
      else if (outcome.status === 'retry') summary.retried += 1;
      else summary.failed += 1;
    }
    return summary;
  };
}

/**
 * The consumer of the dead-letter queue. A message lands there only after the main consumer crashed
 * on it for good (a database outage, say): the outbox row is still due and the sweeper runs it, so
 * all this does is make the loss of a delivery visible. It reports each reference and acknowledges
 * it; the queue would otherwise drop it after its retention without anyone seeing.
 */
export function createDeadLetterConsumer({
  onDead,
}: {
  onDead: (ref: JobRef | null, attempts: number) => void;
}) {
  return async (batch: QueueBatch): Promise<number> => {
    for (const message of batch.messages) {
      onDead(isRef(message.body) ? message.body : null, message.attempts);
      message.ack();
    }
    return batch.messages.length;
  };
}
