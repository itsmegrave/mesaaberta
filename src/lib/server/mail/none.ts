import type { Mailer } from './mailer';

/** No e-mail provider: a message is dropped, so a deployment without one still runs its handlers. */
export const noMailer: Mailer = { async send() {} };
