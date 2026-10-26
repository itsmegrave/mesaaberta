import { reasonLabel } from '#lib/moderation/labels.js';
import type { ReportReason } from '@mesaaberta/core/moderation/reports';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { formatSession } from '@mesaaberta/core/tables/format';
import { presentationOf } from '#lib/badges/presentation.js';
import { atHandle } from '@mesaaberta/core/profile/handle';
import { toPlainText } from '@mesaaberta/core/text/rich';
import {
  ANNOUNCEMENT_ICONS,
  isNotificationType,
  NOTIFICATION_KINDS,
  TABLE_NOTICE_FIELDS,
  type NotificationIcon,
} from '@mesaaberta/core/notifications/kinds';

/** What the bell and the feed need of a notification to word it. */
export type Shown = {
  type: string;
  icon: string | null;
  title: string | null;
  body: string | null;
  metadata: Record<string, string>;
  actor: string | null;
};

type NoticeField = (typeof TABLE_NOTICE_FIELDS)[number];
const FIELD_LABELS: Record<NoticeField, () => string> = {
  startsAt: m.notification_change_schedule,
  timezone: m.notification_change_timezone,
  recurrence: m.notification_change_recurrence,
  until: m.notification_change_recurrence,
  durationMinutes: m.notification_change_duration,
  modality: m.notification_change_place,
  locationArea: m.notification_change_place,
  joinDetails: m.notification_change_join,
  title: m.notification_change_title,
  kind: m.notification_change_kind,
  description: m.notification_change_description,
  extraInfo: m.notification_change_description,
};

/** The changed fields as one list ("duração e local"), each named once, the start left out if shown. */
function changedList(changed: string | undefined, withoutStart: boolean): string {
  const fields = (changed ?? '')
    .split(',')
    .filter((field): field is NoticeField => Object.hasOwn(FIELD_LABELS, field))
    .filter((field) => !(withoutStart && (field === 'startsAt' || field === 'timezone')));
  const labels = [...new Set(fields.map((field) => FIELD_LABELS[field]()))];
  return new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(labels);
}

/** A session reminder, with the start in the viewer's timezone; older reminders stay generic. */
function reminderText(table: string, metadata: Record<string, string>, timeZone: string) {
  const { startsAt, window } = metadata;
  if (!startsAt) return m.notification_session_reminder({ table });
  const when = formatSession(new Date(startsAt), timeZone, getLocale());
  return window === '1h'
    ? m.notification_session_reminder_hour({ table, when })
    : m.notification_session_reminder_day({ table, when });
}

/** A table change, as specific as the notice's metadata allows; older notices stay generic. */
function tableChangeText(table: string, metadata: Record<string, string>, timeZone: string) {
  const { startsAtFrom, startsAtTo, changed } = metadata;
  if (startsAtFrom && startsAtTo) {
    const from = formatSession(new Date(startsAtFrom), timeZone, getLocale());
    const to = formatSession(new Date(startsAtTo), timeZone, getLocale());
    const what = changedList(changed, true);
    return what
      ? m.notification_table_rescheduled_more({ table, from, to, what })
      : m.notification_table_rescheduled({ table, from, to });
  }
  const what = changedList(changed, false);
  return what
    ? m.notification_table_changed({ table, what })
    : m.notification_table_updated({ table });
}

/**
 * The sentence a notification is shown as. An announcement is its own title (and body, which is
 * rich text and reads here as one line). Times are shown in `timeZone`, the viewer's (see
 * shownTimezone).
 */
export function notificationText(item: Shown, timeZone = 'America/Sao_Paulo'): string {
  if (item.title) {
    const body = item.body ? toPlainText(item.body).replace(/\s+/g, ' ') : '';
    return body ? `${item.title}: ${body}` : item.title;
  }

  const table = item.metadata.title ?? '';
  const player = item.actor ? atHandle(item.actor) : m.notification_someone();
  if (!isNotificationType(item.type)) return m.notification_unknown();
  switch (item.type) {
    case 'table_updated':
      return tableChangeText(table, item.metadata, timeZone);
    case 'table_cancelled':
      return m.notification_table_cancelled({ table });
    case 'session_reminder':
      return reminderText(table, item.metadata, timeZone);
    case 'session_confirmation':
      return m.notification_session_confirmation({ table });
    case 'player_invited':
      return m.notification_player_invited({ player, table });
    case 'invitation_accepted':
      return m.notification_invitation_accepted({ player, table });
    case 'invitation_declined':
      return m.notification_invitation_declined({ player, table });
    case 'invitation_expired':
      return m.notification_invitation_expired({ table });
    case 'invitation_cancelled':
      return m.notification_invitation_cancelled({ table });
    case 'join_requested':
      return m.notification_join_requested({ player, table });
    case 'join_approved':
      return m.notification_join_approved({ table });
    case 'join_declined':
      return m.notification_join_declined({ table });
    case 'player_joined':
      return m.notification_player_joined({ player, table });
    case 'player_left':
      return m.notification_player_left({ player, table });
    case 'player_removed':
      return m.notification_player_removed({ table });
    case 'rating_received':
      return m.notification_rating_received({ table });
    case 'rating_prompt':
      return m.notification_rating_prompt({ table });
    case 'badge_earned': {
      // A badge without artwork yet still gets its notice, worded without the name.
      const name = presentationOf(item.metadata.badgeId ?? '')?.name();
      return name
        ? m.notification_badge_earned_named({ badge: name })
        : m.notification_badge_earned();
    }
    case 'catalog_suggestion_approved':
      // A table that waited for its system can be published now.
      if (item.metadata.kind === 'system')
        return m.notification_system_suggestion_approved({ name: item.metadata.name ?? '' });
      return m.notification_catalog_suggestion_approved({ name: item.metadata.name ?? '' });
    case 'catalog_suggestion_merged':
      return m.notification_catalog_suggestion_merged({
        name: item.metadata.name ?? '',
        into: item.metadata.into ?? '',
      });
    case 'catalog_suggestion_rejected':
      if (item.metadata.kind === 'system')
        return m.notification_system_suggestion_rejected({ name: item.metadata.name ?? '' });
      return m.notification_catalog_suggestion_rejected({ name: item.metadata.name ?? '' });
    case 'report_filed_admin':
      return m.notification_report_filed_admin();
    case 'report_resolved':
      return m.notification_report_resolved();
    case 'partner_invited':
      return m.notification_partner_invited({ player, partner: item.metadata.partner ?? '' });
    case 'partner_invitation_accepted':
      return m.notification_partner_invitation_accepted({
        player,
        partner: item.metadata.partner ?? '',
      });
    case 'partner_invitation_declined':
      return m.notification_partner_invitation_declined({
        player,
        partner: item.metadata.partner ?? '',
      });
    case 'partner_owner_removed':
      return m.notification_partner_owner_removed({ player, partner: item.metadata.partner ?? '' });
    case 'moderation_notice':
      if (item.metadata.partnerWithdrawn)
        return m.notification_partner_withdrawn({ partner: item.metadata.partnerWithdrawn });
      if (item.metadata.partnerApproved)
        return m.notification_partner_approved({ partner: item.metadata.partnerApproved });
      if (item.metadata.partnerRemoved) {
        const partner = item.metadata.partnerRemoved;
        const reason = reasonLabel(item.metadata.reason as ReportReason, 'partner');
        return item.metadata.note
          ? m.notification_partner_removed_note({ partner, reason, note: item.metadata.note })
          : m.notification_partner_removed({ partner, reason });
      }
      // A campaign an admin removed says why; a table they closed names it, and the justification
      // is on the GM's dashboard.
      if (item.metadata.campaign) {
        const reason = reasonLabel(item.metadata.reason as ReportReason, 'crowdfunding');
        const campaign = item.metadata.campaign;
        return item.metadata.note
          ? m.notification_crowdfunding_removed_note({ campaign, reason, note: item.metadata.note })
          : m.notification_crowdfunding_removed({ campaign, reason });
      }
      return table
        ? m.notification_table_closed_by_moderation({ table })
        : m.notification_moderation_notice();
    case 'system_announcement':
      return m.notification_unknown();
    case 'message_received': {
      const many = Number(item.metadata.count) > 1;
      const count = Number(item.metadata.count);
      if (item.metadata.kind === 'table') {
        return many
          ? m.notification_message_group_many({ count, table })
          : m.notification_message_group_one({ table });
      }
      return many
        ? m.notification_message_direct_many({ count, player })
        : m.notification_message_direct_one({ player });
    }
  }
}

const ICONS = new Set<string>([
  ...Object.values(NOTIFICATION_KINDS).map((kind) => kind.icon),
  ...ANNOUNCEMENT_ICONS,
]);

/** The notification's own icon when it is one the bell can draw, else its type's. */
export function notificationIcon(item: Pick<Shown, 'type' | 'icon'>): NotificationIcon {
  if (item.icon && ICONS.has(item.icon)) return item.icon as NotificationIcon;
  return isNotificationType(item.type) ? NOTIFICATION_KINDS[item.type].icon : 'megaphone';
}
