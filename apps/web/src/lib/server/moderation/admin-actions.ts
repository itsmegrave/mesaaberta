import {
  moderationDecisions,
  type ModerationDecisionName,
} from '@mesaaberta/core/server/moderation/decisions';
import { moderationAction } from './form-action';

/**
 * One admin console action: the decision's schema and service come from core (the api route runs
 * the same ones), `fields` are the text fields the form posts. Only admins get in.
 */
function decide(name: ModerationDecisionName, fields: readonly string[]) {
  const { schema, apply } = moderationDecisions[name];
  return moderationAction(schema, fields, (db, actor, data) => apply(db, actor, data as never), {
    admin: true,
    decision: name,
  });
}

/** The decisions on one report, for `/admin/reports/[id]`. */
export const reportActions = {
  review: decide('report.review', ['id']),
  accept: decide('report.accept', ['id', 'note']),
  dismiss: decide('report.dismiss', ['id', 'note']),
  closeTable: decide('report.closeTable', ['id', 'note']),
  removeCrowdfunding: decide('report.removeCrowdfunding', ['id', 'reason', 'note', 'reportId']),
  removePartner: decide('report.removePartner', ['id', 'reason', 'note', 'reportId']),
  ban: decide('report.ban', ['id', 'duration', 'reason']),
};

/** Banning and revoking from the user's page, `/admin/users/[id]`. */
export const accountActions = {
  ban: decide('account.ban', ['profileId', 'duration', 'reason']),
  revoke: decide('account.revoke', ['profileId']),
};

/** Giving a badge by hand, giving one back or taking it away, from `/admin/users/[id]`. */
export const badgeActions = {
  grantBadge: decide('badge.grant', ['profileId', 'badgeId', 'reason']),
  revokeBadge: decide('badge.revoke', ['profileId', 'badgeId', 'reason']),
};

/** Taking a campaign down from the crowdfunding list, `/admin/crowdfunding`. */
export const crowdfundingActions = {
  remove: decide('crowdfunding.remove', ['id', 'reason', 'note']),
};

/** Approving, rejecting and correcting the kinds of partners from the list, `/admin/partners`. */
export const partnerActions = {
  approve: decide('partner.approve', ['id']),
  remove: decide('partner.remove', ['id', 'reason', 'note']),
  setTypes: decide('partner.setTypes', ['id', 'types']),
};

/** Approving, rejecting and removing places from the "Onde jogar" queue, `/admin/places`. */
export const placeActions = {
  approve: decide('place.approve', ['id']),
  remove: decide('place.remove', ['id', 'reason', 'note']),
};

/** Closing a table from the tables list, `/admin/tables`. */
export const tableActions = {
  close: decide('table.close', ['tableId', 'note']),
};
