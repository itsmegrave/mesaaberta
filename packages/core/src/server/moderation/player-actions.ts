import { z } from 'zod';
import {
  partnerIdSchema,
  reportCrowdfundingSchema,
  reportPartnerSchema,
  reportSchema,
} from '../../moderation/reports';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { fileCrowdfundingReport } from '../crowdfunding/service';
import { filePartnerReport, withdrawPartner } from '../partners/service';
import { fileReport } from './reports';

/**
 * What a signed-in member does about someone else's table, partner or campaign, and the one thing a
 * submitter does to their own partner, by name: the form's own schema and the service call. The web
 * form actions (the report dialogs and "Remover…" on a partner card) and the api route
 * (`POST /v1/reports/:action`) both run these. Each answers the `eventIds` to dispatch after the
 * response; the service authorizes the actor and counts the report against its limit.
 */
export const playerModerationActions = {
  /** "Denunciar" on a table: the table, or a player the reporter shares it with. */
  table: {
    schema: reportSchema.extend({ slug: z.string().min(1).max(200) }),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      data: z.output<typeof reportSchema> & { slug: string },
    ) => {
      const { slug, ...input } = data;
      return [(await fileReport(db, actor, slug, input)).eventId];
    },
  },
  partner: {
    schema: reportPartnerSchema,
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      { id, reason, details }: z.output<typeof reportPartnerSchema>,
    ) => [(await filePartnerReport(db, actor, id, { reason, details })).eventId],
  },
  crowdfunding: {
    schema: reportCrowdfundingSchema,
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      { id, reason, details }: z.output<typeof reportCrowdfundingSchema>,
    ) => [(await fileCrowdfundingReport(db, actor, id, { reason, details })).eventId],
  },
  /** The submitter takes their own partner off. */
  withdrawPartner: {
    schema: partnerIdSchema,
    apply: (db: AnyDb, actor: Actor | null, { id }: z.output<typeof partnerIdSchema>) =>
      withdrawPartner(db, actor, id),
  },
};

export type PlayerModerationActionName = keyof typeof playerModerationActions;
