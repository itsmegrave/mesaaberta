<script lang="ts" module>
  /** Every status the app shows, by what it is about. */
  export type Status =
    | 'changelog:new'
    | 'changelog:improved'
    | 'changelog:fixed'
    | 'user:active'
    | 'user:suspended'
    | 'user:banned'
    | 'table:active'
    | 'table:awaiting_confirmation'
    | 'table:concluded'
    | 'table:going_on'
    | 'table:not_held'
    | 'table:draft'
    | 'table:disabled'
    | 'seat:pending'
    | 'seat:confirmed'
    | 'invitation:pending'
    | 'invitation:accepted'
    | 'invitation:declined'
    | 'invitation:expired'
    | 'invitation:cancelled'
    | 'report:open'
    | 'report:reviewing'
    | 'report:resolved'
    | 'report:dismissed'
    | 'crowdfunding:upcoming'
    | 'crowdfunding:running'
    | 'crowdfunding:ended'
    | 'crowdfunding:removed'
    | 'partner:pending'
    | 'partner:up'
    | 'partner:removed'
    | 'partner:withdrawn'
    | 'place:pending'
    | 'place:up'
    | 'place:hidden'
    | 'place:removed'
    | 'claim:pending'
    | 'claim:approved'
    | 'claim:rejected'
    | 'catalog:approved'
    | 'catalog:pending'
    | 'catalog:disabled'
    | 'notification:delivered'
    | 'notification:pending'
    | 'notification:failed'
    | 'post:published'
    | 'post:queued'
    | 'post:processing'
    | 'post:publishing'
    | 'post:uncertain'
    | 'post:failed'
    | 'post:skipped'
    | 'post:none'
    | 'instagram:connected'
    | 'instagram:expired'
    | 'instagram:disconnected';
</script>

<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';

  /**
   * A status as a dot and a word in a pill (the design system's StatusBadge: 28px, a hairline border
   * on the surface, 650 weight), never colour alone. A filled dot is a current state; a hollow ring
   * is "not (yet) going ahead". Table statuses appear only in admin: players
   * and GMs only ever see active tables.
   */
  let { status, class: className = '' }: { status: Status; class?: string } = $props();

  type Look = { label: () => string; dot: string; text?: 'muted' | 'danger' };
  const LOOKS: Record<Status, Look> = {
    'changelog:new': { label: () => m.changelog_new(), dot: 'bg-success-500' },
    'changelog:improved': { label: () => m.changelog_improved(), dot: 'bg-secondary-300' },
    'changelog:fixed': { label: () => m.changelog_fixed(), dot: 'bg-tertiary-400' },
    'user:active': { label: () => m.status_user_active(), dot: 'bg-success-500' },
    'user:suspended': { label: () => m.status_user_suspended(), dot: 'bg-warning-500' },
    'user:banned': { label: () => m.status_user_banned(), dot: 'bg-error-500', text: 'danger' },
    'table:active': { label: () => m.status_table_active(), dot: 'bg-success-500' },
    'table:awaiting_confirmation': {
      label: () => m.status_table_awaiting_confirmation(),
      dot: 'bg-warning-500',
    },
    // A campaign or adventure between sessions: open, taking players, not yet concluded.
    'table:going_on': { label: () => m.manage_going_status(), dot: 'bg-success-500' },
    'table:concluded': { label: () => m.status_table_concluded(), dot: 'bg-primary-500' },
    // A hollow dot: it did not happen.
    'table:not_held': {
      label: () => m.status_table_not_held(),
      dot: 'border-2 border-surface-500 bg-transparent',
      text: 'muted',
    },
    // A hollow dot: it is not public yet.
    'table:draft': {
      label: () => m.status_table_draft(),
      dot: 'border-2 border-surface-500 bg-transparent',
      text: 'muted',
    },
    'table:disabled': {
      label: () => m.status_table_disabled(),
      dot: 'bg-surface-500',
      text: 'muted',
    },
    // A hollow ring: the request takes no seat yet.
    'seat:pending': {
      label: () => m.status_seat_pending(),
      dot: 'border-2 border-warning-500 bg-transparent',
    },
    'seat:confirmed': { label: () => m.status_seat_confirmed(), dot: 'bg-success-500' },
    // An invite holds a seat while it waits; once answered or lapsed it holds nothing.
    'invitation:pending': {
      label: () => m.invitation_status_pending(),
      dot: 'border-2 border-warning-500 bg-transparent',
    },
    'invitation:accepted': { label: () => m.invitation_status_accepted(), dot: 'bg-success-500' },
    'invitation:declined': {
      label: () => m.invitation_status_declined(),
      dot: 'border-2 border-surface-500 bg-transparent',
    },
    'invitation:expired': {
      label: () => m.invitation_status_expired(),
      dot: 'border-2 border-surface-500 bg-transparent',
    },
    'invitation:cancelled': {
      label: () => m.invitation_status_cancelled(),
      dot: 'border-2 border-surface-500 bg-transparent',
    },
    // Admin only: a report waits (open, in review), or it was decided (accepted, archived).
    'report:open': { label: () => m.report_status_open(), dot: 'bg-error-500' },
    'report:reviewing': { label: () => m.report_status_reviewing(), dot: 'bg-warning-500' },
    'report:resolved': { label: () => m.report_status_resolved(), dot: 'bg-success-500' },
    'report:dismissed': {
      label: () => m.report_status_dismissed(),
      dot: 'border-2 border-surface-500 bg-transparent',
    },
    // A campaign's situation is worked out from its dates; an admin's removal is the only one stored.
    'crowdfunding:upcoming': {
      label: () => m.crowdfunding_status_upcoming(),
      dot: 'bg-primary-500',
    },
    'crowdfunding:running': { label: () => m.crowdfunding_status_running(), dot: 'bg-success-500' },
    'crowdfunding:ended': {
      label: () => m.crowdfunding_status_ended(),
      dot: 'border-2 border-surface-500 bg-transparent',
      text: 'muted',
    },
    'crowdfunding:removed': {
      label: () => m.crowdfunding_status_removed(),
      dot: 'bg-error-500',
      text: 'danger',
    },
    // A partner waits for an admin, is on the page, was taken down, or was taken off by its submitter.
    'partner:pending': { label: () => m.partner_status_pending(), dot: 'bg-warning-500' },
    'partner:up': { label: () => m.partner_status_up(), dot: 'bg-success-500' },
    'partner:removed': {
      label: () => m.partner_status_removed(),
      dot: 'bg-error-500',
      text: 'danger',
    },
    'partner:withdrawn': {
      label: () => m.partner_status_withdrawn(),
      dot: 'border-2 border-surface-500 bg-transparent',
      text: 'muted',
    },
    // A place waits for an admin, is listed, was hidden by reports, or was taken down.
    'place:pending': { label: () => m.partner_status_pending(), dot: 'bg-warning-500' },
    'place:up': { label: () => m.partner_status_up(), dot: 'bg-success-500' },
    'place:hidden': {
      label: () => m.place_status_hidden(),
      dot: 'border-2 border-warning-500 bg-transparent',
    },
    'place:removed': {
      label: () => m.partner_status_removed(),
      dot: 'bg-error-500',
      text: 'danger',
    },
    // A claim on a place waits for an admin, or was approved or turned down.
    'claim:pending': { label: () => m.partner_status_pending(), dot: 'bg-warning-500' },
    'claim:approved': { label: () => m.admin_claims_status_approved(), dot: 'bg-success-500' },
    'claim:rejected': {
      label: () => m.admin_claims_status_rejected(),
      dot: 'bg-surface-500',
      text: 'muted',
    },
    'catalog:approved': { label: () => m.admin_catalog_status_approved(), dot: 'bg-success-500' },
    'catalog:pending': { label: () => m.admin_catalog_status_pending(), dot: 'bg-warning-500' },
    'catalog:disabled': { label: () => m.admin_catalog_status_disabled(), dot: 'bg-surface-500' },
    'notification:delivered': {
      label: () => m.admin_history_status_delivered(),
      dot: 'bg-success-500',
    },
    'notification:pending': {
      label: () => m.admin_history_status_pending(),
      dot: 'bg-warning-500',
    },
    'notification:failed': { label: () => m.admin_history_status_failed(), dot: 'bg-error-500' },
    // A table's Instagram post: published, on its way, to be checked, failed, or none to speak of.
    'post:published': { label: () => m.instagram_status_published(), dot: 'bg-success-500' },
    'post:queued': { label: () => m.instagram_status_queued(), dot: 'bg-primary-500' },
    'post:processing': { label: () => m.instagram_status_processing(), dot: 'bg-primary-500' },
    'post:publishing': { label: () => m.instagram_status_publishing(), dot: 'bg-primary-500' },
    'post:uncertain': { label: () => m.instagram_status_uncertain(), dot: 'bg-warning-500' },
    'post:failed': { label: () => m.instagram_status_failed(), dot: 'bg-error-500' },
    'post:skipped': {
      label: () => m.instagram_status_skipped(),
      dot: 'border-2 border-surface-500 bg-transparent',
    },
    'post:none': {
      label: () => m.instagram_status_none(),
      dot: 'border-2 border-surface-500 bg-transparent',
    },
    'instagram:connected': { label: () => m.instagram_status_connected(), dot: 'bg-success-500' },
    'instagram:expired': { label: () => m.instagram_status_expired(), dot: 'bg-warning-500' },
    'instagram:disconnected': {
      label: () => m.instagram_status_disconnected(),
      dot: 'bg-surface-500',
    },
  };
  const look = $derived(LOOKS[status]);
</script>

<span
  class="inline-flex h-6 max-w-full shrink-0 items-center gap-2 rounded-full border border-surface-200-800 bg-panel px-2 text-xs font-[650] whitespace-nowrap {look.text ===
  'danger'
    ? 'text-error-700-300'
    : look.text === 'muted'
      ? 'text-muted'
      : ''} {className}"
>
  <span aria-hidden="true" class="size-2 shrink-0 rounded-full {look.dot}"></span>
  {look.label()}
</span>
