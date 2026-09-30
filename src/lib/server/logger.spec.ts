import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

const capture = () => {
  const lines: Record<string, unknown>[] = [];
  const log = createLogger({
    write: (_level, line) => lines.push(JSON.parse(line)),
    now: () => new Date('2026-09-19T21:00:00Z'),
  });
  return { lines, log };
};

describe('logger', () => {
  it('writes JSON with reserved envelope fields and operational context', () => {
    const { lines, log } = capture();
    log.info('request.completed', {
      event: 'request.completed',
      status: 200,
      durationMs: 5,
      level: 'fatal',
      time: 'fake',
      service: 'fake',
    });
    expect(lines).toEqual([
      {
        event: 'request.completed',
        status: 200,
        durationMs: 5,
        service: 'mesaaberta',
        schemaVersion: 1,
        time: '2026-09-19T21:00:00.000Z',
        level: 'info',
        msg: 'request.completed',
      },
    ]);
  });
  it('stamps children with the request id without contaminating the parent', () => {
    const { lines, log } = capture();
    log.child({ requestId: '0123456789abcdef-GRU' }).info('first');
    log.info('outside');
    expect(lines[0]).toMatchObject({ requestId: '0123456789abcdef-GRU' });
    expect(lines[1]).not.toHaveProperty('requestId');
  });
  it('drops free text, identities and nested secrets before any destination', () => {
    const { lines, log } = capture();
    log.info('safe', {
      userId: 'user-1',
      name: 'Ana',
      email: 'ana@example.com',
      token: 'secret',
      request: { headers: { cookie: 'sid=secret' } },
      form: { password: 'secret' },
    });
    expect(JSON.stringify(lines)).not.toMatch(/secret|Ana|ana@example|user-1/);
  });
  it('keeps error types and SQLSTATE without messages, stacks or causes containing values', () => {
    const { lines, log } = capture();
    log.error('query.failed', {
      error: new Error('Failed query: secret', {
        cause: Object.assign(new Error('ana@example.com'), { code: '23505' }),
      }),
    });
    expect(lines[0]).toMatchObject({ errorType: 'Error', causeCode: '23505' });
    expect(JSON.stringify(lines)).not.toMatch(/secret|ana@example/);
  });
  it('scrubs credentials accidentally included in a message', () => {
    const { lines, log } = capture();
    log.warn('rejected ana@example.com Bearer abc password=xyz');
    expect(lines[0].msg).toBe('rejected [redacted] [redacted] [redacted]');
  });
  it('ignores cyclic unknown fields and survives an unavailable destination', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    const log = createLogger({
      write: () => {
        throw new Error('unavailable');
      },
    });
    expect(() => log.info('safe', { loop })).not.toThrow();
  });
  it('preserves severity for every destination', () => {
    const levels: string[] = [];
    const log = createLogger({ write: (level) => levels.push(level) });
    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');
    expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
  });
});
