import type { ErrorEvent } from '@sentry/cloudflare';
import { describe, expect, it } from 'vitest';
import { privateEvent, privateLog, privateSentryOptions } from './sentry-options';

describe('sentry options', () => {
  it('withholds exception messages and request data', () => {
    const event = {
      event_id: 'e1',
      exception: {
        values: [
          { type: 'TypeError', value: 'ana@example.com failed', stacktrace: { frames: [] } },
        ],
      },
      request: { url: 'https://x.test/?token=abc' },
      user: { email: 'ana@example.com' },
      breadcrumbs: [{ message: 'secret' }],
    } as unknown as ErrorEvent;
    const out = privateEvent(event) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain('ana@example.com');
    expect(out.request).toBeUndefined();
    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
  });

  it('forwards only the application logger and scrubs its message', () => {
    expect(
      privateLog({ level: 'info', message: 'x', attributes: { service: 'other' } }),
    ).toBeNull();
    const kept = privateLog({
      level: 'info',
      message: 'sent to ana@example.com',
      attributes: { service: 'mesaaberta' },
    });
    expect(kept?.message).toBe('sent to [redacted]');
  });

  it('drops transactions, metrics and breadcrumbs and sends no PII', () => {
    expect(privateSentryOptions.sendDefaultPii).toBe(false);
    expect(privateSentryOptions.beforeSendTransaction()).toBeNull();
    expect(privateSentryOptions.beforeSendMetric()).toBeNull();
    expect(privateSentryOptions.beforeBreadcrumb()).toBeNull();
  });
});
