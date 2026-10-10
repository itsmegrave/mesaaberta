import { describe, expect, it, vi } from 'vitest';
import type { Mail } from './mailer';
import { mailpitMailer } from './mailpit';

const env = {
  MAILPIT_URL: 'http://127.0.0.1:54344/',
  RESEND_FROM: 'Mesa Aberta <convites@mesaaberta.local>',
};

const inline: Mail = {
  to: 'ana@example.com',
  subject: 'Convite: Mesa do Dragão',
  text: 'Você tem uma vaga confirmada.',
  idempotencyKey: 'event:player:REQUEST',
};

const capture = (status = 200) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return new Response('{}', { status });
  }) as unknown as typeof fetch;
  const body = () => JSON.parse(String(calls[0].init.body));
  return { request, calls, body };
};

describe('mailpit mailer', () => {
  it('sends inline e-mail through the Mailpit HTTP provider', async () => {
    const sent = capture();

    await mailpitMailer(env, sent.request).send({ ...inline, text: 'Olá <Ana> & amigos\nfim' });

    expect(sent.calls[0].url).toBe('http://127.0.0.1:54344/api/v1/send');
    expect(sent.body()).toMatchObject({
      From: { Name: 'Mesa Aberta', Email: 'convites@mesaaberta.local' },
      To: [{ Email: 'ana@example.com' }],
      Subject: 'Convite: Mesa do Dragão',
      Text: 'Olá <Ana> & amigos\nfim',
      HTML: '<p>Olá &lt;Ana&gt; &amp; amigos<br>fim</p>',
      Headers: { 'Idempotency-Key': 'event:player:REQUEST' },
    });
  });

  it('keeps attachments in Mailpit format', async () => {
    const sent = capture();

    await mailpitMailer(env, sent.request).send({
      ...inline,
      attachments: [
        {
          filename: 'mesa-aberta.ics',
          content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
          contentType: 'text/calendar; method=REQUEST; charset=utf-8',
        },
      ],
    });

    expect(sent.body().Attachments[0]).toMatchObject({
      Filename: 'mesa-aberta.ics',
      ContentType: 'text/calendar; method=REQUEST; charset=utf-8',
    });
    expect(Buffer.from(sent.body().Attachments[0].Content, 'base64').toString()).toBe(
      'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
    );
  });

  it('falls back to inline text instead of Resend-hosted templates', async () => {
    const sent = capture();

    await mailpitMailer(env, sent.request).send({
      ...inline,
      template: { id: 'tpl-invite', variables: {} as never },
    });

    expect(sent.body().Text).toBe(inline.text);
    expect(sent.body()).not.toHaveProperty('template');
  });

  it('throws when Mailpit refuses, so the sweeper retries the event', async () => {
    const sent = capture(500);

    await expect(mailpitMailer(env, sent.request).send(inline)).rejects.toThrow(
      'Mailpit request failed (500)',
    );
  });
});
