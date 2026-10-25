// The words of a moderation decision taken from more than one page (a list's row menu and the
// report that asks for it), so both dialogs say the same. Pages spread them into ModerationDialog
// and keep their own action, schema and fields.
import {
  CROWDFUNDING_REPORT_REASONS,
  PARTNER_REPORT_REASONS,
  RESOLUTION_NOTE_MAX,
  type ReportReason,
  type ReportTarget,
} from '@mesaaberta/core/moderation/reports';
import { m } from '#lib/paraglide/messages.js';

type Write = { name: 'note' | 'reason'; label: string; hint: string; required?: boolean };
type Words = {
  label: string;
  title: string;
  text: string;
  confirm: string;
  success: string;
};

/** Taking a campaign down, with the reason and a note. */
export function removeCrowdfunding(name: string): Words & {
  danger: true;
  reasons: readonly ReportReason[];
  write: Write;
} {
  return {
    danger: true,
    reasons: CROWDFUNDING_REPORT_REASONS,
    write: {
      name: 'note',
      label: m.admin_crowdfunding_remove_note(),
      hint: m.admin_crowdfunding_remove_note_hint({ max: RESOLUTION_NOTE_MAX }),
    },
    label: m.admin_crowdfunding_remove(),
    title: m.admin_crowdfunding_remove_title({ name }),
    text: m.admin_crowdfunding_remove_text(),
    confirm: m.admin_crowdfunding_remove_confirm(),
    success: m.admin_crowdfunding_remove_done(),
  };
}

/** Taking a partner down (or turning one down), with the reason and a note. */
export function removePartner(name: string): Words & {
  danger: true;
  reasons: readonly ReportReason[];
  reasonTarget: ReportTarget;
  write: Write;
} {
  return {
    danger: true,
    reasons: PARTNER_REPORT_REASONS,
    reasonTarget: 'partner',
    write: {
      name: 'note',
      label: m.admin_partners_remove_note(),
      hint: m.admin_partners_remove_note_hint({ max: RESOLUTION_NOTE_MAX }),
    },
    label: m.admin_partners_remove(),
    title: m.admin_partners_remove_title({ name }),
    text: m.admin_partners_remove_text(),
    confirm: m.admin_partners_remove_confirm(),
    success: m.admin_partners_remove_done(),
  };
}

/**
 * Closing a table, with the GM's justification. The list and the report word the button, the text
 * and the toast each for where they are.
 */
export function closeTable(table: string): {
  danger: true;
  write: Write;
  title: string;
  confirm: string;
} {
  return {
    danger: true,
    write: {
      name: 'note',
      label: m.moderation_close_table_note(),
      hint: m.moderation_close_table_hint({ max: RESOLUTION_NOTE_MAX }),
      required: true,
    },
    title: m.admin_report_close_table_title({ table }),
    confirm: m.admin_report_close_table(),
  };
}

/** The reason a suspension or a ban gives the person. */
export function banReason(): Write {
  return {
    name: 'reason',
    label: m.moderation_ban_reason(),
    hint: m.moderation_ban_reason_hint({ max: RESOLUTION_NOTE_MAX }),
    required: true,
  };
}

/** Banning for good, from the user's page or the report about them. The trigger says its own word. */
export function ban(user: string): Omit<Words, 'label'> & {
  danger: true;
  durations: true;
  write: Write;
} {
  return {
    danger: true,
    durations: true,
    write: banReason(),
    title: m.admin_ban_title({ user }),
    text: m.admin_ban_text(),
    confirm: m.admin_ban(),
    success: m.admin_ban_done(),
  };
}
