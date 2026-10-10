import {
  settle,
  type JobExecutor,
  type JobOutcome,
  type JobRef,
  type JobTransport,
} from './transport';

type Message = { ref: JobRef; attempt: number; visibleAt: number };

/**
 * An in-process transport with the semantics every adapter must have: at-least-once delivery,
 * redelivery with delay on retry, and a dead-letter list after the attempt cap. It exists to pin
 * those semantics in tests, without Cloudflare or a database.
 */
export function createMemoryTransport(options: {
  executor: JobExecutor;
  maxAttempts?: number;
  backoffSeconds?: (attempt: number) => number;
}) {
  const {
    executor,
    maxAttempts = 8,
    backoffSeconds = (attempt) => 30 * 2 ** (attempt - 1),
  } = options;
  const queue: Message[] = [];
  const deadLetters: { ref: JobRef; reason: string }[] = [];
  let clock = 0;

  const transport: JobTransport = {
    async enqueue(ref, { delaySeconds = 0 } = {}) {
      queue.push({ ref, attempt: 0, visibleAt: clock + delaySeconds * 1000 });
    },
  };

  /** Delivers every message that is due at the current time, once each. */
  async function drain(): Promise<JobOutcome[]> {
    const due = queue.filter((message) => message.visibleAt <= clock);
    const outcomes: JobOutcome[] = [];
    for (const message of due) {
      queue.splice(queue.indexOf(message), 1);
      message.attempt += 1;
      const outcome = await settle(message.ref, executor, {
        attempt: message.attempt,
        maxAttempts,
        backoffSeconds,
      });
      outcomes.push(outcome);
      if (outcome.status === 'retry') {
        queue.push({ ...message, visibleAt: clock + outcome.afterSeconds * 1000 });
      } else if (outcome.status === 'failed') {
        deadLetters.push({ ref: message.ref, reason: outcome.reason });
      }
    }
    return outcomes;
  }

  return {
    transport,
    drain,
    deadLetters,
    pending: () => queue.length,
    advance(seconds: number) {
      clock += seconds * 1000;
    },
  };
}
