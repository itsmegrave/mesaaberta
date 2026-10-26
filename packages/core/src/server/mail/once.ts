// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { eq, lt } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { mailDeliveries } from '../db/schema';
import type { Mail, Mailer } from './mailer';

const DAY = 24 * 3600 * 1000;

/** How long a delivery is remembered: well past any retry of the event that sent it. */
export const MAIL_DELIVERY_RETENTION_DAYS = 30;

/**
 * Sends `mail` unless its idempotency key already went out. Resend drops a repeated key for 24 hours
 * only, and an event retried after a backoff can come back later than that, so the key is kept here
 * once the provider took it. A crash between the two is the provider's 24 hours to cover. Answers
 * whether it sent.
 */
export async function sendOnce(db: AnyDb, mailer: Mailer, mail: Mail): Promise<boolean> {
  const [sent] = await db
    .select({ key: mailDeliveries.key })
    .from(mailDeliveries)
    .where(eq(mailDeliveries.key, mail.idempotencyKey));
  if (sent) return false;
  await mailer.send(mail);
  await db.insert(mailDeliveries).values({ key: mail.idempotencyKey }).onConflictDoNothing();
  return true;
}

/** Forgets the deliveries past `MAIL_DELIVERY_RETENTION_DAYS`. Returns how many it deleted. */
export async function pruneMailDeliveries(db: AnyDb, now = new Date()): Promise<number> {
  const deleted = await db
    .delete(mailDeliveries)
    .where(lt(mailDeliveries.sentAt, new Date(now.getTime() - MAIL_DELIVERY_RETENTION_DAYS * DAY)))
    .returning({ key: mailDeliveries.key });
  return deleted.length;
}
