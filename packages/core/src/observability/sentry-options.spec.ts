import type { ErrorEvent } from '@sentry/core';
import { describe, expect, it } from 'vitest';
import {
  privateEvent,
  privateLog,
  privateSentryOptions,
  sentryOptionsForApp,
  sentryReleaseFor,
} from './sentry-options';

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

  it('drops a request the app cancelled itself', () => {
    const aborted = {
      event_id: 'e1',
      exception: { values: [{ type: 'AbortError', value: 'signal is aborted without reason' }] },
    } as unknown as ErrorEvent;
    expect(privateEvent(aborted)).toBeNull();
    expect(sentryOptionsForApp('web').beforeSend(aborted)).toBeNull();
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

  it('tags every event with the app that raised it', () => {
    const options = sentryOptionsForApp('api');
    expect(options.initialScope.tags.app).toBe('api');
    const event = { event_id: 'e1', tags: { app: 'web', route: '/x' } } as unknown as ErrorEvent;
    expect(options.beforeSend(event)?.tags).toEqual({ app: 'api', route: '/x' });
    expect(
      privateLog({ level: 'info', message: 'x', attributes: { service: 'mesaaberta', app: 'api' } })
        ?.attributes,
    ).toEqual({ service: 'mesaaberta', app: 'api' });
  });

  it('names the release tag and the app, as the deploy uploads the source maps', () => {
    const env = { DEPLOYMENT_VERSION: 'v0.70.0', CF_VERSION_METADATA: { id: 'cf-version' } };
    expect(sentryReleaseFor('web', env)).toEqual({ release: '0.70.0', dist: 'web' });
    expect(sentryReleaseFor('worker', env)).toEqual({ release: '0.70.0', dist: 'worker' });
  });

  it('keeps the Worker version id as the release without a tag', () => {
    expect(sentryReleaseFor('api', { CF_VERSION_METADATA: { id: 'cf-version' } })).toEqual({
      release: 'cf-version',
    });
    expect(sentryReleaseFor('api', undefined)).toEqual({ release: undefined });
  });

  it('keeps the flags the request read, and nothing else from the contexts', () => {
    const event = {
      contexts: {
        flags: {
          values: [
            { flag: 'api_inbox', result: true },
            { flag: 'ana@example.com', result: true },
            { flag: 'use_badges', result: 'yes' },
          ],
        },
        cloud_resource: { 'cloud.provider': 'cloudflare' },
      },
    } as unknown as ErrorEvent;

    expect(privateEvent(event)?.contexts).toEqual({
      flags: { values: [{ flag: 'api_inbox', result: true }] },
    });
    expect(privateEvent({ type: undefined })?.contexts).toBeUndefined();
  });
});
