import { describe, expect, it } from 'vitest';
import { sentryOptionsFor } from './privacy';

const dsn = 'https://key@o1.ingest.example.test/1';

describe('sentryOptionsFor', () => {
  it('sends nothing without a DSN', () => {
    const options = sentryOptionsFor({}, 'https://app.example.test', true);
    expect(options.enabled).toBe(false);
    expect(options.dsn).toBeUndefined();
  });

  it('sends nothing outside a production build', () => {
    const options = sentryOptionsFor({ PUBLIC_SENTRY_DSN: dsn }, 'http://localhost:5173', false);
    expect(options.enabled).toBe(false);
  });

  it('reports from any origin when none is named', () => {
    const options = sentryOptionsFor({ PUBLIC_SENTRY_DSN: dsn }, 'https://app.example.test', true);
    expect(options).toMatchObject({ enabled: true, dsn });
  });

  it('reports only from the named origin', () => {
    const env = { PUBLIC_SENTRY_DSN: dsn, PUBLIC_SENTRY_ORIGIN: 'https://app.example.test' };
    expect(sentryOptionsFor(env, 'https://app.example.test', true).enabled).toBe(true);
    expect(sentryOptionsFor(env, 'https://preview.workers.example.test', true).enabled).toBe(false);
  });

  it('keeps the privacy policy', () => {
    const options = sentryOptionsFor({ PUBLIC_SENTRY_DSN: dsn }, 'https://app.example.test', true);
    expect(options).toMatchObject({ sendDefaultPii: false, tracesSampleRate: 1 });
  });
});
