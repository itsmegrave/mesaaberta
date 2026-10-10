import type { Mailer } from './mailer';
import { mailpitMailer } from './mailpit';
import { noMailer } from './none';
import { resendMailer } from './resend';

export type { Mail, Mailer } from './mailer';

/** Which transport a deployment sends through. Mailpit (local/E2E) wins over Resend; `none` opts out. */
export type MailEnv = {
  MAIL_PROVIDER?: string;
  MAILPIT_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM: string;
};

/** Whether `mailerFor` can build a transport: `none`, Mailpit or Resend credentials. */
export const mailConfigured = (env: Partial<MailEnv>) =>
  env.MAIL_PROVIDER === 'none' || Boolean(env.MAILPIT_URL || env.RESEND_API_KEY);

/**
 * The transport for this deployment (ADR 0001/0007): `MAIL_PROVIDER=none` drops mail, Mailpit when
 * `MAILPIT_URL` is set, otherwise Resend. Unset keeps today's behaviour, so a deployment opts out,
 * not in. Resend without a key is a configuration error, not a silent drop.
 */
export function mailerFor(env: MailEnv, request: typeof fetch = fetch): Mailer {
  if (env.MAIL_PROVIDER === 'none') return noMailer;
  if (env.MAILPIT_URL)
    return mailpitMailer({ MAILPIT_URL: env.MAILPIT_URL, RESEND_FROM: env.RESEND_FROM }, request);
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required without MAILPIT_URL');
  return resendMailer(
    { RESEND_API_KEY: env.RESEND_API_KEY, RESEND_FROM: env.RESEND_FROM },
    request,
  );
}
