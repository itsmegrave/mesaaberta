import { describe, expect, it } from 'vitest';
import { privateEvent, privateLog, safeFields, scrubString } from './privacy';

describe('telemetry privacy boundary', () => {
  it('only forwards validated operational fields, dropping nested secrets and identity', () => {
    expect(
      safeFields({
        requestId: '0123456789abcdef-GRU',
        status: 503,
        durationMs: 10,
        errorType: 'TypeError',
        userId: 'user-1',
        name: 'Ana',
        email: 'ana@example.com',
        password: '123',
        nested: { authorization: 'Bearer xyz', cookie: 'sid=abc', session_id: 'secret' },
        route: '/tables/[slug]',
        tableId: 'not-an-id',
        code: 'secret with spaces',
      }),
    ).toEqual({
      requestId: '0123456789abcdef-GRU',
      status: 503,
      durationMs: 10,
      errorType: 'TypeError',
      route: '/tables/[slug]',
    });
  });
  it('removes request context and exception content while preserving code locations', () => {
    const event = privateEvent({
      type: undefined,
      event_id: 'event',
      request: {
        url: 'https://site.test/?token=secret',
        headers: { cookie: 'sid=secret' },
        data: { password: 'secret' },
      },
      user: { email: 'ana@example.com', ip_address: '1.2.3.4' },
      extra: { form: 'secret' },
      breadcrumbs: [{ message: 'secret' }],
      tags: { requestId: '0123456789abcdef-GRU', user: 'Ana' },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'password=secret',
            stacktrace: {
              frames: [
                {
                  filename: '/app.js?token=secret',
                  lineno: 12,
                  vars: { password: 'secret' },
                  context_line: 'secret',
                },
              ],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/secret|ana@example|1\.2\.3\.4|Ana/);
    expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).toMatchObject({
      filename: '/app.js',
      lineno: 12,
    });
    expect(event.tags).toEqual({ requestId: '0123456789abcdef-GRU' });
  });
  it('drops automatic SDK logs and removes unknown attributes from application logs', () => {
    expect(privateLog({ level: 'info', message: 'raw console' })).toBeNull();
    expect(
      privateLog({
        level: 'warn',
        message: 'failed ana@example.com Bearer abc password=xyz',
        attributes: { service: 'mesaaberta', status: 500, body: 'private' },
      }),
    ).toEqual({
      level: 'warn',
      message: 'failed [redacted] [redacted] [redacted]',
      attributes: { service: 'mesaaberta', status: 500 },
    });
  });
  it('scrubs token and session credentials embedded in free text', () => {
    expect(scrubString('session_id=abc token=xyz cookie=sid=123')).not.toMatch(/abc|xyz|123/);
  });
});
