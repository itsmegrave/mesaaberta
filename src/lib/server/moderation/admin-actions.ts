import { eq } from 'drizzle-orm';
import {
  accountSchema,
  banEnd,
  banFromReportSchema,
  banSchema,
  closeReportSchema,
  closeTableSchema,
  reportIdSchema,
} from '$lib/moderation/reports';
import type { AnyDb } from '../db/client';
import { reports } from '../db/schema';
import { Invalid } from '../errors';
import { banAccount, closeReport, closeReportedTable, revokeBan, startReview } from './admin';
import { moderationAction } from './form-action';

const admin = { admin: true };

/** The player a report is about: the only profile a ban from that report can hit. */
async function reportedPlayer(db: AnyDb, id: string) {
  const [row] = await db
    .select({ targetType: reports.targetType, targetId: reports.targetId })
    .from(reports)
    .where(eq(reports.id, id));
  if (!row || row.targetType !== 'player') throw new Invalid('id', 'not_found');
  return row.targetId;
}

/** The decisions on one report, for `/admin/reports/[id]`. */
export const reportActions = {
  review: moderationAction(
    reportIdSchema,
    ['id'],
    (db, actor, { id }) => startReview(db, actor, id),
    admin,
  ),
  accept: moderationAction(
    closeReportSchema,
    ['id', 'note'],
    (db, actor, { id, note }) => closeReport(db, actor, id, 'resolved', note),
    admin,
  ),
  dismiss: moderationAction(
    closeReportSchema,
    ['id', 'note'],
    (db, actor, { id, note }) => closeReport(db, actor, id, 'dismissed', note),
    admin,
  ),
  // A table report: close the table, with the justification its GM reads.
  closeTable: moderationAction(
    closeTableSchema,
    ['id', 'note'],
    (db, actor, { id, note }) => closeReportedTable(db, actor, id, note),
    admin,
  ),
  // A player report: ban the reported profile, for a while or for good.
  ban: moderationAction(
    banFromReportSchema,
    ['id', 'duration', 'reason'],
    async (db, actor, { id, duration, reason }) => {
      const now = new Date();
      return banAccount(db, actor, await reportedPlayer(db, id), {
        until: banEnd(duration, now),
        reason,
        reportId: id,
        now,
      });
    },
    admin,
  ),
};

/** Banning and revoking from the user's page, `/admin/users/[id]`. */
export const accountActions = {
  ban: moderationAction(
    banSchema,
    ['profileId', 'duration', 'reason'],
    (db, actor, { profileId, duration, reason }) => {
      const now = new Date();
      return banAccount(db, actor, profileId, { until: banEnd(duration, now), reason, now });
    },
    admin,
  ),
  revoke: moderationAction(
    accountSchema,
    ['profileId'],
    (db, actor, { profileId }) => revokeBan(db, actor, profileId),
    admin,
  ),
};
