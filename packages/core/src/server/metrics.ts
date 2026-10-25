/**
 * The few numbers a self-hosted deployment is watched by, in Prometheus text format. A process
 * keeps its own counts in memory, so this is meaningful only where one process serves many
 * requests (a Bun container); on Workers every isolate would report its own handful, and the web
 * app does not serve `/metrics` there.
 *
 * Labels are bounded on purpose: the route template (never a path), the method from a fixed set,
 * and the status class. Nothing here names a person or a record.
 */

/** Seconds. Tuned to a page that answers in tens of milliseconds and a slow one in seconds. */
const BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

type Histogram = { counts: number[]; sum: number; count: number };

export type HttpMetrics = {
  /** Counts one finished request. */
  observe: (request: { route: string; method: string; status: number; seconds: number }) => void;
  /** The Prometheus text for what was observed since the process started. */
  render: () => string;
};

const escape = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const labels = (pairs: Record<string, string>) =>
  Object.entries(pairs)
    .map(([k, v]) => `${k}="${escape(v)}"`)
    .join(',');

/** `service` is the process (`web`, `api`, `worker`), so one scrape config reads all three. */
export function createHttpMetrics(service: string): HttpMetrics {
  const requests = new Map<string, number>();
  const durations = new Map<string, Histogram>();

  return {
    observe({ route, method, status, seconds }) {
      const safeMethod = METHODS.has(method) ? method : 'OTHER';
      const requestKey = `${route}\n${safeMethod}\n${Math.floor(status / 100)}xx`;
      requests.set(requestKey, (requests.get(requestKey) ?? 0) + 1);

      const histogram = durations.get(route) ?? {
        counts: BUCKETS.map(() => 0),
        sum: 0,
        count: 0,
      };
      BUCKETS.forEach((le, i) => {
        if (seconds <= le) histogram.counts[i]++;
      });
      histogram.sum += seconds;
      histogram.count++;
      durations.set(route, histogram);
    },

    render() {
      const lines = [
        '# HELP mesaaberta_http_requests_total Requests answered, by route template, method and status class.',
        '# TYPE mesaaberta_http_requests_total counter',
      ];
      for (const [key, value] of requests) {
        const [route, method, status] = key.split('\n');
        lines.push(
          `mesaaberta_http_requests_total{${labels({ service, route, method, status })}} ${value}`,
        );
      }
      lines.push(
        '# HELP mesaaberta_http_request_duration_seconds Time to answer a request, by route template.',
        '# TYPE mesaaberta_http_request_duration_seconds histogram',
      );
      for (const [route, h] of durations) {
        BUCKETS.forEach((le, i) =>
          lines.push(
            `mesaaberta_http_request_duration_seconds_bucket{${labels({ service, route, le: String(le) })}} ${h.counts[i]}`,
          ),
        );
        lines.push(
          `mesaaberta_http_request_duration_seconds_bucket{${labels({ service, route, le: '+Inf' })}} ${h.count}`,
          `mesaaberta_http_request_duration_seconds_sum{${labels({ service, route })}} ${h.sum}`,
          `mesaaberta_http_request_duration_seconds_count{${labels({ service, route })}} ${h.count}`,
        );
      }
      return lines.join('\n') + '\n';
    },
  };
}

export type JobMetrics = {
  /** Records one run of a background job; `ok` is false when it threw. */
  observe: (run: { job: string; ok: boolean; seconds: number; at: Date }) => void;
  /** The outbox as the worker last read it; rendered as gauges until the next reading. */
  setOutbox: (depth: { pending: number; failed: number; oldestPendingSeconds: number }) => void;
  /** Records one run of an event handler. Handler names are a fixed set, so the labels stay bounded. */
  observeHandler: (run: { handler: string; ok: boolean; seconds: number }) => void;
  render: () => string;
};

/** What the worker is watched by: how often each job ran, how long it took, and when it last did. */
export function createJobMetrics(service: string): JobMetrics {
  const runs = new Map<string, { ok: number; failed: number; sum: number; last: number }>();
  let outbox: { pending: number; failed: number; oldestPendingSeconds: number } | undefined;
  const handlers = new Map<string, { ok: number; failed: number; sum: number }>();

  return {
    observeHandler({ handler, ok, seconds }) {
      const entry = handlers.get(handler) ?? { ok: 0, failed: 0, sum: 0 };
      entry[ok ? 'ok' : 'failed']++;
      entry.sum += seconds;
      handlers.set(handler, entry);
    },

    setOutbox(depth) {
      outbox = depth;
    },

    observe({ job, ok, seconds, at }) {
      const entry = runs.get(job) ?? { ok: 0, failed: 0, sum: 0, last: 0 };
      entry[ok ? 'ok' : 'failed']++;
      entry.sum += seconds;
      entry.last = at.getTime() / 1000;
      runs.set(job, entry);
    },

    render() {
      const lines = [
        '# HELP mesaaberta_job_runs_total Background job runs, by job and outcome.',
        '# TYPE mesaaberta_job_runs_total counter',
      ];
      for (const [job, e] of runs) {
        lines.push(
          `mesaaberta_job_runs_total{${labels({ service, job, outcome: 'ok' })}} ${e.ok}`,
          `mesaaberta_job_runs_total{${labels({ service, job, outcome: 'failed' })}} ${e.failed}`,
        );
      }
      lines.push(
        '# HELP mesaaberta_job_run_seconds_sum Seconds spent running a job, in total.',
        '# TYPE mesaaberta_job_run_seconds_sum counter',
      );
      for (const [job, e] of runs)
        lines.push(`mesaaberta_job_run_seconds_sum{${labels({ service, job })}} ${e.sum}`);
      lines.push(
        '# HELP mesaaberta_job_last_run_timestamp_seconds When a job last finished, in Unix time.',
        '# TYPE mesaaberta_job_last_run_timestamp_seconds gauge',
      );
      for (const [job, e] of runs)
        lines.push(
          `mesaaberta_job_last_run_timestamp_seconds{${labels({ service, job })}} ${e.last}`,
        );
      lines.push(
        '# HELP mesaaberta_event_handler_runs_total Event handler runs, by handler and outcome.',
        '# TYPE mesaaberta_event_handler_runs_total counter',
      );
      for (const [handler, e] of handlers) {
        lines.push(
          `mesaaberta_event_handler_runs_total{${labels({ service, handler, outcome: 'ok' })}} ${e.ok}`,
          `mesaaberta_event_handler_runs_total{${labels({ service, handler, outcome: 'failed' })}} ${e.failed}`,
        );
      }
      lines.push(
        '# HELP mesaaberta_event_handler_seconds_sum Seconds spent in an event handler, in total.',
        '# TYPE mesaaberta_event_handler_seconds_sum counter',
      );
      for (const [handler, e] of handlers)
        lines.push(
          `mesaaberta_event_handler_seconds_sum{${labels({ service, handler })}} ${e.sum}`,
        );
      if (outbox) {
        lines.push(
          '# HELP mesaaberta_outbox_events Events in the outbox, by state, as of the last sweep.',
          '# TYPE mesaaberta_outbox_events gauge',
          `mesaaberta_outbox_events{${labels({ service, state: 'pending' })}} ${outbox.pending}`,
          `mesaaberta_outbox_events{${labels({ service, state: 'failed' })}} ${outbox.failed}`,
          '# HELP mesaaberta_outbox_oldest_pending_seconds How long the oldest pending event has been due.',
          '# TYPE mesaaberta_outbox_oldest_pending_seconds gauge',
          `mesaaberta_outbox_oldest_pending_seconds{${labels({ service })}} ${outbox.oldestPendingSeconds}`,
        );
      }
      return lines.join('\n') + '\n';
    },
  };
}
