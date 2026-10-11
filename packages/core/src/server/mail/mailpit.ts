import type { Mail, Mailer } from './mailer';
import { escapeHtml, utf8Base64 } from './resend';
import { welcomeHtml, welcomeSection } from './templates';

export type MailpitEnv = { MAILPIT_URL: string; RESEND_FROM: string };
type Fetch = typeof fetch;

const address = (value: string) => {
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  return match
    ? { Name: match[1].replace(/^"|"$/g, '').trim(), Email: match[2] }
    : { Email: value.trim() };
};

const content = (mail: Mail) => {
  const welcome = welcomeSection(mail.welcomeMessage);
  const text = welcome ? `${mail.text}\n\n${welcome}` : mail.text;
  const html = `<p>${escapeHtml(mail.text).replace(/\n/g, '<br>')}</p>${welcomeHtml(mail.welcomeMessage) ?? ''}`;
  return { Text: text, HTML: html };
};

/** Local/E2E transport: send the same messages into Supabase's Mailpit HTTP API. */
export function mailpitMailer(env: MailpitEnv, request: Fetch = fetch): Mailer {
  return {
    async send(mail) {
      const response = await request(`${env.MAILPIT_URL.replace(/\/$/, '')}/api/v1/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          From: address(env.RESEND_FROM),
          To: [address(mail.to)],
          Subject: mail.subject,
          ...content(mail),
          Headers: { 'Idempotency-Key': mail.idempotencyKey },
          Attachments: mail.attachments?.map((attachment) => ({
            Filename: attachment.filename,
            Content: utf8Base64(attachment.content),
            ContentType: attachment.contentType,
          })),
        }),
      });
      if (!response.ok) throw new Error(`Mailpit request failed (${response.status})`);
    },
  };
}
