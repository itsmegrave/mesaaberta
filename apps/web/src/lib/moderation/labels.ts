import { m } from '$lib/paraglide/messages';
import type { ReportReason, ReportStatus, ReportTarget } from './reports';

/** A campaign's spam is the repeated kind: it is the same link posted again and again. */
export const reasonLabel = (reason: ReportReason, target: ReportTarget = 'table') =>
  ({
    spam:
      target === 'crowdfunding' || target === 'partner'
        ? m.report_reason_spam_repeated
        : m.report_reason_spam,
    harassment: m.report_reason_harassment,
    inappropriate_content: m.report_reason_inappropriate_content,
    no_show: m.report_reason_no_show,
    other: m.report_reason_other,
    broken_link: m.report_reason_broken_link,
    scam: m.report_reason_scam,
    off_topic: m.report_reason_off_topic,
    no_backlink: m.report_reason_no_backlink,
  })[reason]();

export const reportStatusLabel = (status: ReportStatus) =>
  ({
    open: m.report_status_open,
    reviewing: m.report_status_reviewing,
    resolved: m.report_status_resolved,
    dismissed: m.report_status_dismissed,
  })[status]();
