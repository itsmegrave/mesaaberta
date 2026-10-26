import type { ErrorEvent, TransactionEvent } from '@sentry/core';
import { describe, expect, it } from 'vitest';
import {
  privateEvent,
  privateLog,
  privateSentryOptions,
  privateSpan,
  privateTransaction,
  coloOf,
  sentryOptionsForApp,
  sentryReleaseFor,
} from './sentry-options';
import { safeFields } from './privacy';

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

  it('drops metrics and breadcrumbs, sends no PII and traces every request', () => {
    expect(privateSentryOptions.sendDefaultPii).toBe(false);
    expect(privateSentryOptions.tracesSampleRate).toBe(1);
    expect(privateSentryOptions.traceLifecycle).toBe('static');
    expect(privateSentryOptions.beforeSendMetric()).toBeNull();
    expect(privateSentryOptions.beforeBreadcrumb()).toBeNull();
  });

  it("keeps a transaction's timings and route, never its request, user or payloads", () => {
    const event = {
      type: 'transaction',
      event_id: 't1',
      timestamp: 2,
      start_timestamp: 1,
      release: 'v1.0.0',
      dist: 'web',
      environment: 'production',
      transaction: 'GET /t/[slug]?token=abc',
      transaction_info: { source: 'route' },
      tags: { route: '/t/[slug]', email: 'ana@example.com' },
      measurements: { lcp: { value: 1200, unit: 'millisecond' } },
      request: { url: 'https://mesaaberta.app/t/x?q=ana', headers: { cookie: 'sid=1' } },
      user: { id: 'u1', email: 'ana@example.com' },
      breadcrumbs: [{ message: 'clicked' }],
      extra: { body: 'secret' },
      contexts: {
        trace: {
          trace_id: 'a'.repeat(32),
          span_id: 'b'.repeat(16),
          op: 'http.server',
          status: 'ok',
          data: { 'http.response.status_code': 200, 'url.full': 'https://x/y?q=1' },
        },
        runtime: { name: 'workerd' },
      },
      spans: [
        {
          span_id: 'c'.repeat(16),
          trace_id: 'a'.repeat(32),
          start_timestamp: 1,
          timestamp: 1.5,
          status: 'ok',
          op: 'http.client',
          description: 'GET https://db.example.test/rest/v1/tables?select=*&email=eq.ana',
          data: {
            'http.request.method': 'GET',
            'url.full': 'https://x?q=1',
            'http.response.status_code': 200,
          },
        },
        {
          span_id: 'd'.repeat(16),
          trace_id: 'a'.repeat(32),
          start_timestamp: 1,
          status: 'ok',
          op: 'db.query',
          description: "select * from profiles where email = 'ana@example.com' and age > 30",
          data: { 'db.statement': 'select 1' },
        },
      ],
    } as unknown as TransactionEvent;
    const kept = privateTransaction(event);
    expect(kept).not.toHaveProperty('request');
    expect(kept).not.toHaveProperty('user');
    expect(kept).not.toHaveProperty('breadcrumbs');
    expect(kept).not.toHaveProperty('extra');
    expect(kept).toMatchObject({
      type: 'transaction',
      transaction: 'GET /t/[slug]',
      transaction_info: { source: 'route' },
      tags: { route: '/t/[slug]' },
      measurements: { lcp: { value: 1200, unit: 'millisecond' } },
      release: 'v1.0.0',
      dist: 'web',
    });
    expect(kept.contexts).toEqual({
      runtime: { name: 'workerd', version: undefined },
      trace: expect.objectContaining({
        op: 'http.server',
        data: { 'http.response.status_code': 200 },
      }),
    });
    expect(kept.spans?.[0]).toMatchObject({
      description: 'GET https://db.example.test/rest/v1/tables',
      data: { 'http.request.method': 'GET', 'http.response.status_code': 200 },
    });
    expect(kept.spans?.[0]?.data).not.toHaveProperty('url.full');
    expect(kept.spans?.[1]?.description).toBe('select * from profiles where email = ? and age > ?');
    expect(kept.spans?.[1]?.data).toEqual({});
  });

  it('scrubs standalone spans the same way', () => {
    const span = privateSpan({
      span_id: 'c'.repeat(16),
      trace_id: 'a'.repeat(32),
      start_timestamp: 1,
      status: 'ok',
      op: 'ui.interaction.click',
      description: 'body > button.ana@example.com',
      data: { 'sentry.op': 'ui.interaction.click', 'user_agent.original': 'Mozilla' },
    });
    expect(span.description).toBe('body > [redacted]');
    expect(span.data).toEqual({ 'sentry.op': 'ui.interaction.click' });
  });

  it('tags every transaction with the app that sent it', () => {
    const options = sentryOptionsForApp('worker');
    const event = { type: 'transaction', tags: { app: 'web' } } as unknown as TransactionEvent;
    expect(options.beforeSendTransaction(event).tags).toEqual({ app: 'worker' });
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

  it('names the Cloudflare data center from the runtime or the cf-ray header', () => {
    const withCf = Object.assign(new Request('https://x.test/'), { cf: { colo: 'GRU' } });
    expect(coloOf(withCf)).toBe('GRU');
    const withRay = new Request('https://x.test/', {
      headers: { 'cf-ray': '8d2f0a1b2c3d4e5f-EWR' },
    });
    expect(coloOf(withRay)).toBe('EWR');
    expect(coloOf(new Request('https://x.test/'))).toBeUndefined();
    expect(safeFields({ colo: 'GRU' })).toEqual({ colo: 'GRU' });
  });

  it('keeps the runtime and cloud contexts on a transaction', () => {
    const event = {
      type: 'transaction',
      contexts: {
        runtime: { name: 'cloudflare' },
        cloud_resource: { 'cloud.provider': 'cloudflare' },
        os: { name: 'Android' },
      },
    } as unknown as TransactionEvent;
    expect(privateTransaction(event).contexts).toEqual({
      runtime: { name: 'cloudflare', version: undefined },
      cloud_resource: { 'cloud.provider': 'cloudflare', 'cloud.region': undefined },
    });
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
        cloud_resource: { 'cloud.provider': 'cloudflare', 'host.name': 'box-1' },
        runtime: { name: 'cloudflare', raw_description: 'Mozilla/5.0 (ana)' },
        device: { model: 'Pixel 9' },
      },
    } as unknown as ErrorEvent;

    expect(privateEvent(event)?.contexts).toEqual({
      flags: { values: [{ flag: 'api_inbox', result: true }] },
      cloud_resource: { 'cloud.provider': 'cloudflare', 'cloud.region': undefined },
      runtime: { name: 'cloudflare', version: undefined },
    });
    expect(privateEvent({ type: undefined })?.contexts).toBeUndefined();
  });
});
