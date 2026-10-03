<script lang="ts" module>
  /** Every status the app shows, by what it is about. */
  export type Status =
    | 'user:active'
    | 'user:suspended'
    | 'user:banned'
    | 'table:active'
    | 'table:awaiting_confirmation'
    | 'table:concluded'
    | 'table:not_held'
    | 'table:disabled'
    | 'seat:pending'
    | 'seat:confirmed'
    | 'report:open'
    | 'report:reviewing'
    | 'report:resolved'
    | 'report:dismissed'
    | 'catalog:approved'
    | 'catalog:pending'
    | 'catalog:disabled'
    | 'notification:delivered'
    | 'notification:pending'
    | 'notification:failed'
    | 'instagram:connected'
    | 'instagram:expired'
    | 'instagram:disconnected';
</script>

<script lang="ts">
  import { m } from '$lib/paraglide/messages';

  /**
   * A status as a dot and a word, never colour alone. Table statuses appear only in admin: players
   * and GMs only ever see active tables.
   */
  let { status, class: className = '' }: { status: Status; class?: string } = $props();

  type Look = { label: () => string; dot: string };
  const LOOKS: Record<Status, Look> = {
    'user:active': { label: () => m.status_user_active(), dot: 'bg-success-500' },
    'user:suspended': { label: () => m.status_user_suspended(), dot: 'bg-warning-500' },
    'user:banned': { label: () => m.status_user_banned(), dot: 'bg-error-500' },
    'table:active': { label: () => m.status_table_active(), dot: 'bg-success-500' },
    'table:awaiting_confirmation': {
      label: () => m.status_table_awaiting_confirmation(),
      dot: 'bg-warning-500',
    },
    'table:concluded': { label: () => m.status_table_concluded(), dot: 'bg-primary-500' },
    // A hollow dot: it did not happen.
    'table:not_held': {
      label: () => m.status_table_not_held(),
      dot: 'border-2 border-surface-500 bg-transparent',
    },
    'table:disabled': { label: () => m.status_table_disabled(), dot: 'bg-surface-500' },
    'seat:pending': { label: () => m.status_seat_pending(), dot: 'bg-warning-500' },
    'seat:confirmed': { label: () => m.status_seat_confirmed(), dot: 'bg-success-500' },
    // Admin only: a report waits (open, in review), or it was decided (accepted, archived).
    'report:open': { label: () => m.report_status_open(), dot: 'bg-error-500' },
    'report:reviewing': { label: () => m.report_status_reviewing(), dot: 'bg-warning-500' },
    'report:resolved': { label: () => m.report_status_resolved(), dot: 'bg-success-500' },
    'report:dismissed': {
      label: () => m.report_status_dismissed(),
      dot: 'border-2 border-surface-500 bg-transparent',
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
    'instagram:connected': { label: () => m.instagram_status_connected(), dot: 'bg-success-500' },
    'instagram:expired': { label: () => m.instagram_status_expired(), dot: 'bg-warning-500' },
    'instagram:disconnected': {
      label: () => m.instagram_status_disconnected(),
      dot: 'bg-surface-500',
    },
  };
  const look = $derived(LOOKS[status]);
</script>

<span class="inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap {className}">
  <span aria-hidden="true" class="size-2.5 shrink-0 rounded-full {look.dot}"></span>
  {look.label()}
</span>
