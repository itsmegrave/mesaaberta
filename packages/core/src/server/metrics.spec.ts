import { describe, expect, it } from 'vitest';
import { createHttpMetrics, createJobMetrics } from './metrics';

describe('createHttpMetrics', () => {
  it('counts requests by route template, method and status class', () => {
    const metrics = createHttpMetrics('web');
    metrics.observe({ route: '/tables/[slug]', method: 'GET', status: 200, seconds: 0.02 });
    metrics.observe({ route: '/tables/[slug]', method: 'GET', status: 204, seconds: 0.03 });
    metrics.observe({ route: '/tables/[slug]', method: 'POST', status: 500, seconds: 0.4 });

    const text = metrics.render();
    expect(text).toContain(
      'mesaaberta_http_requests_total{service="web",route="/tables/[slug]",method="GET",status="2xx"} 2',
    );
    expect(text).toContain('method="POST",status="5xx"} 1');
  });

  it('puts a duration in every bucket at or above it, with a total and a sum', () => {
    const metrics = createHttpMetrics('api');
    metrics.observe({ route: '/healthz', method: 'GET', status: 200, seconds: 0.03 });

    const text = metrics.render();
    expect(text).toContain('duration_seconds_bucket{service="api",route="/healthz",le="0.01"} 0');
    expect(text).toContain('le="0.05"} 1');
    expect(text).toContain('le="+Inf"} 1');
    expect(text).toContain('duration_seconds_sum{service="api",route="/healthz"} 0.03');
    expect(text).toContain('duration_seconds_count{service="api",route="/healthz"} 1');
  });

  it('folds an unknown method into OTHER, so a caller cannot grow the label set', () => {
    const metrics = createHttpMetrics('web');
    metrics.observe({ route: '/', method: 'BREW', status: 200, seconds: 0.01 });

    expect(metrics.render()).toContain('method="OTHER"');
  });

  it('renders valid, empty output before any request', () => {
    expect(createHttpMetrics('web').render()).toContain(
      '# TYPE mesaaberta_http_requests_total counter',
    );
  });
});

describe('createJobMetrics', () => {
  it('counts runs by outcome, adds up their time and remembers the last one', () => {
    const metrics = createJobMetrics('worker');
    metrics.observe({ job: '*/5 * * * *', ok: true, seconds: 1.5, at: new Date(1_000_000) });
    metrics.observe({ job: '*/5 * * * *', ok: false, seconds: 0.5, at: new Date(2_000_000) });

    const text = metrics.render();
    expect(text).toContain(
      'mesaaberta_job_runs_total{service="worker",job="*/5 * * * *",outcome="ok"} 1',
    );
    expect(text).toContain('outcome="failed"} 1');
    expect(text).toContain('mesaaberta_job_run_seconds_sum{service="worker",job="*/5 * * * *"} 2');
    expect(text).toContain(
      'mesaaberta_job_last_run_timestamp_seconds{service="worker",job="*/5 * * * *"} 2000',
    );
  });
});
