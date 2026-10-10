import { describe, expect, it, vi } from 'vitest';
import { mailConfigured, mailerFor } from '.';

const mail = { to: 'a@b.c', subject: 's', text: 't', idempotencyKey: 'k' };
const ok = () => vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }));

describe('mailerFor', () => {
  it('drops mail when MAIL_PROVIDER is none, even with Resend credentials', async () => {
    const request = ok();
    const env = { MAIL_PROVIDER: 'none', RESEND_API_KEY: 'k', RESEND_FROM: 'f@x.y' };
    await mailerFor(env, request).send(mail);
    expect(request).not.toHaveBeenCalled();
  });

  it('sends through Mailpit when MAILPIT_URL is set, ahead of Resend', async () => {
    const request = ok();
    const env = {
      MAILPIT_URL: 'http://localhost:54324',
      RESEND_API_KEY: 'k',
      RESEND_FROM: 'f@x.y',
    };
    await mailerFor(env, request).send(mail);
    expect(String(request.mock.calls[0][0])).toBe('http://localhost:54324/api/v1/send');
  });

  it('sends through Resend by default', async () => {
    const request = ok();
    await mailerFor({ RESEND_API_KEY: 'k', RESEND_FROM: 'f@x.y' }, request).send(mail);
    expect(String(request.mock.calls[0][0])).toBe('https://api.resend.com/emails');
  });

  it('refuses Resend without a key instead of dropping mail', () => {
    expect(() => mailerFor({ RESEND_FROM: 'f@x.y' })).toThrow('RESEND_API_KEY');
  });
});

describe('mailConfigured', () => {
  it.each([
    [{}, false],
    [{ RESEND_API_KEY: 'k' }, true],
    [{ MAILPIT_URL: 'http://m' }, true],
    [{ MAIL_PROVIDER: 'none' }, true],
  ])('%j -> %s', (env, expected) => expect(mailConfigured(env)).toBe(expected));
});
