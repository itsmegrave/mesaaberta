import { eq } from 'drizzle-orm';
import { activeAdmins } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { crowdfundings, gameTables, notifications, partners, profiles } from '../db/schema';
import { ownersOf } from '../partners/owners';
import { NOTIFICATION_KINDS, type NotificationType } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

type ModerationEvent = Extract<
  StoredEvent,
  {
    type:
      | 'ReportFiled'
      | 'ReportResolved'
      | 'ReportDismissed'
      | 'TableClosedByModeration'
      | 'CrowdfundingRemoved'
      | 'PartnerApproved'
      | 'PartnerRemoved';
  }
>;

async function recipientsOf(db: AnyDb, event: ModerationEvent) {
  if (event.type === 'CrowdfundingRemoved')
    return event.payload.submitterId ? [event.payload.submitterId] : [];
  // Everyone who looks after the partner now, or the submitter when it is gone.
  if (event.type === 'PartnerApproved' || event.type === 'PartnerRemoved')
    return ownersOf(db, { id: event.payload.partnerId, submitterId: event.payload.submitterId });
  if (event.type === 'TableClosedByModeration') {
    const [table] = await db
      .select({ gmId: gameTables.gmId })
      .from(gameTables)
      .where(eq(gameTables.id, event.payload.tableId));
    return table ? [table.gmId] : [];
  }
  if (event.type !== 'ReportFiled') return [event.payload.reporterId];
  const admins = await db.select({ id: profiles.id }).from(profiles).where(activeAdmins());
  return admins.map((admin) => admin.id);
}

/**
 * The bell for moderation: a new report reaches every active admin (linked to it in the queue), the
 * reporter hears when it is closed (never what was done or by whom), and a GM whose table an admin
 * closed is told, with no link: a disabled table is a 404, and so is the submitter of a campaign an
 * admin removed, told why. A partner's decisions reach every account that looks after it, and when
 * one of them withdrew it the others hear that instead of a reason. One row per event and
 * recipient, so a retry adds nothing. Nobody is told about what they did themselves.
 */
export const moderationHandler: Handler = {
  name: 'moderation-notifications-v1',
  types: [
    'ReportFiled',
    'ReportResolved',
    'ReportDismissed',
    'TableClosedByModeration',
    'CrowdfundingRemoved',
    'PartnerApproved',
    'PartnerRemoved',
  ],
  async handle(event, db) {
    const moderation = event as ModerationEvent;
    const type: NotificationType =
      moderation.type === 'ReportFiled'
        ? 'report_filed_admin'
        : moderation.type === 'TableClosedByModeration' ||
            moderation.type === 'CrowdfundingRemoved' ||
            moderation.type === 'PartnerApproved' ||
            moderation.type === 'PartnerRemoved'
          ? 'moderation_notice'
          : 'report_resolved';
    const recipients = (await recipientsOf(db, moderation)).filter((id) => id !== event.actorId);
    if (recipients.length === 0) return;

    // What the submitter is told: the campaign, the reason and the admin's note, if they wrote one.
    let removal: Record<string, string> = {};
    if (moderation.type === 'CrowdfundingRemoved') {
      const [campaign] = await db
        .select({ note: crowdfundings.removalNote })
        .from(crowdfundings)
        .where(eq(crowdfundings.id, moderation.payload.crowdfundingId));
      removal = {
        crowdfundingId: moderation.payload.crowdfundingId,
        campaign: moderation.payload.name,
        reason: moderation.payload.reason,
        ...(campaign?.note ? { note: campaign.note } : {}),
      };
    }

    // A partner that was approved, or sent back with the reason and the admin's note, if any.
    if (moderation.type === 'PartnerApproved') {
      removal = {
        partnerId: moderation.payload.partnerId,
        partnerApproved: moderation.payload.name,
      };
    } else if (moderation.type === 'PartnerRemoved') {
      const [partner] = await db
        .select({ note: partners.removalNote })
        .from(partners)
        .where(eq(partners.id, moderation.payload.partnerId));
      removal = moderation.payload.reason
        ? {
            partnerId: moderation.payload.partnerId,
            partnerRemoved: moderation.payload.name,
            reason: moderation.payload.reason,
            ...(partner?.note ? { note: partner.note } : {}),
          }
        : { partnerId: moderation.payload.partnerId, partnerWithdrawn: moderation.payload.name };
    }

    const reportId = 'reportId' in moderation.payload ? moderation.payload.reportId : null;
    await db
      .insert(notifications)
      .values(
        recipients.map((recipientId) => ({
          recipientId,
          // The reporter is never named, not even to an admin's bell: the queue shows who it was.
          actorId: null,
          eventId: event.id,
          category: NOTIFICATION_KINDS[type].category,
          type,
          link: type === 'report_filed_admin' ? `/admin/reports/${reportId}` : null,
          metadata:
            moderation.type === 'CrowdfundingRemoved' ||
            moderation.type === 'PartnerApproved' ||
            moderation.type === 'PartnerRemoved'
              ? removal
              : moderation.type === 'TableClosedByModeration'
                ? {
                    reportId,
                    tableId: moderation.payload.tableId,
                    slug: moderation.payload.slug,
                    title: moderation.payload.title,
                  }
                : { reportId },
          createdAt: event.createdAt,
        })),
      )
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
