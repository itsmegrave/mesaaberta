import { eq } from 'drizzle-orm';
import type { ZodType, z } from 'zod';
import { badgeDecisionSchema } from '../../badges/grants';
import {
  accountSchema,
  approvePartnerSchema,
  approvePlaceSchema,
  banEnd,
  banFromReportSchema,
  banSchema,
  closeReportSchema,
  closeTableByIdSchema,
  closeTableSchema,
  partnerTypesSchema,
  removeCrowdfundingSchema,
  removePartnerSchema,
  removePlaceSchema,
  restorePlaceSchema,
  reportIdSchema,
} from '../../moderation/reports';
import type { Actor } from '../auth/policy';
import { grantBadge, revokeBadge } from '../badges/admin';
import { removeCrowdfunding } from '../crowdfunding/admin';
import type { AnyDb } from '../db/client';
import { reports } from '../db/schema';
import { Invalid } from '../errors';
import { approvePartner, removePartner, setPartnerTypes } from '../partners/admin';
import { approvePlace, removePlace, restorePlace } from '../places/admin';
import { approveClaim, rejectClaim, removePlaceOwner } from '../places/claims';
import { approveClaimSchema, placeOwnerSchema, rejectClaimSchema } from '../../places/claims';
import {
  banAccount,
  closeReport,
  closeReportedTable,
  closeTableByAdmin,
  revokeBan,
  startReview,
} from './admin';
import { reportSubject } from './reports';

type Decision<Schema extends ZodType> = {
  schema: Schema;
  apply: (db: AnyDb, actor: Actor | null, data: z.output<Schema>) => Promise<string | string[]>;
};
const decision = <Schema extends ZodType>(d: Decision<Schema>) => d;

/** The person a report is about (`reportSubject`): the only profile a ban from that report can hit. */
async function reportedPlayer(db: AnyDb, id: string) {
  const [row] = await db
    .select({
      targetType: reports.targetType,
      targetId: reports.targetId,
      subjectId: reports.subjectId,
    })
    .from(reports)
    .where(eq(reports.id, id));
  const subject = row ? reportSubject(row) : null;
  if (!subject) throw new Invalid('id', 'not_found');
  return subject;
}

/**
 * Every admin moderation decision the console makes, by name: the form's own schema and the
 * service call. The web form actions and the api route (`POST /v1/admin/moderation/:decision`) both
 * run these, so a decision is defined once and the two paths cannot drift. The service authorizes
 * the actor; what it refuses is thrown (`Invalid`, `Forbidden`, `NotFound`, `RateLimited`).
 */
export const moderationDecisions = {
  // On one report, `/admin/reports/[id]`.
  'report.review': decision({
    schema: reportIdSchema,
    apply: (db, actor, { id }) => startReview(db, actor, id),
  }),
  'report.accept': decision({
    schema: closeReportSchema,
    apply: (db, actor, { id, note }) => closeReport(db, actor, id, 'resolved', note),
  }),
  'report.dismiss': decision({
    schema: closeReportSchema,
    apply: (db, actor, { id, note }) => closeReport(db, actor, id, 'dismissed', note),
  }),
  // A table report: close the table, with the justification its GM reads.
  'report.closeTable': decision({
    schema: closeTableSchema,
    apply: (db, actor, { id, note }) => closeReportedTable(db, actor, id, note),
  }),
  // A campaign report: take the campaign down, which accepts this report with the others about it.
  'report.removeCrowdfunding': decision({
    schema: removeCrowdfundingSchema,
    apply: (db, actor, { id, reason, note, reportId }) =>
      removeCrowdfunding(db, actor, id, { reason, note, reportId }),
  }),
  // A partner report: take the partner down, which accepts this report with the others about it.
  'report.removePartner': decision({
    schema: removePartnerSchema,
    apply: (db, actor, { id, reason, note, reportId }) =>
      removePartner(db, actor, id, { reason, note, reportId }),
  }),
  // A player report: ban the reported profile, for a while or for good.
  'report.ban': decision({
    schema: banFromReportSchema,
    apply: async (db, actor, { id, duration, reason }) => {
      const now = new Date();
      return banAccount(db, actor, await reportedPlayer(db, id), {
        until: banEnd(duration, now),
        reason,
        reportId: id,
        now,
      });
    },
  }),
  // From the user's page, `/admin/users/[id]`.
  'account.ban': decision({
    schema: banSchema,
    apply: (db, actor, { profileId, duration, reason }) => {
      const now = new Date();
      return banAccount(db, actor, profileId, { until: banEnd(duration, now), reason, now });
    },
  }),
  'account.revoke': decision({
    schema: accountSchema,
    apply: (db, actor, { profileId }) => revokeBan(db, actor, profileId),
  }),
  // Giving a badge by hand, or taking one away, also from the user's page.
  'badge.grant': decision({
    schema: badgeDecisionSchema,
    apply: (db, actor, data) => grantBadge(db, actor, data),
  }),
  'badge.revoke': decision({
    schema: badgeDecisionSchema,
    apply: (db, actor, data) => revokeBadge(db, actor, data),
  }),
  // Taking a campaign down from the crowdfunding list, `/admin/crowdfunding`.
  'crowdfunding.remove': decision({
    schema: removeCrowdfundingSchema,
    apply: (db, actor, { id, reason, note }) => removeCrowdfunding(db, actor, id, { reason, note }),
  }),
  // Approving and rejecting partners from the partners list, `/admin/partners`.
  'partner.approve': decision({
    schema: approvePartnerSchema,
    apply: (db, actor, { id }) => approvePartner(db, actor, id),
  }),
  'partner.remove': decision({
    schema: removePartnerSchema,
    apply: (db, actor, { id, reason, note }) => removePartner(db, actor, id, { reason, note }),
  }),
  'partner.setTypes': decision({
    schema: partnerTypesSchema,
    apply: (db, actor, { id, types }) => setPartnerTypes(db, actor, id, types),
  }),
  // Approving, rejecting and removing "Onde jogar" places from `/admin/places`.
  'place.approve': decision({
    schema: approvePlaceSchema,
    apply: (db, actor, { id }) => approvePlace(db, actor, id),
  }),
  'place.remove': decision({
    schema: removePlaceSchema,
    apply: (db, actor, { id, reason, note, reportId }) =>
      removePlace(db, actor, id, { reason, note, reportId: reportId || null }),
  }),
  // Claims from `/admin/places/claims`, and taking an owner off from `/admin/places`.
  'place.approveClaim': decision({
    schema: approveClaimSchema,
    apply: (db, actor, { id }) => approveClaim(db, actor, id),
  }),
  'place.rejectClaim': decision({
    schema: rejectClaimSchema,
    apply: (db, actor, { id, note }) => rejectClaim(db, actor, id, { note }),
  }),
  'place.removeOwner': decision({
    schema: placeOwnerSchema,
    apply: (db, actor, { id }) => removePlaceOwner(db, actor, id),
  }),
  'place.restore': decision({
    schema: restorePlaceSchema,
    apply: (db, actor, { id, note }) => restorePlace(db, actor, id, { note }),
  }),
  // Closing a table from the tables list, `/admin/tables`.
  'table.close': decision({
    schema: closeTableByIdSchema,
    apply: (db, actor, { tableId, note }) => closeTableByAdmin(db, actor, tableId, note),
  }),
};

export type ModerationDecisionName = keyof typeof moderationDecisions;
