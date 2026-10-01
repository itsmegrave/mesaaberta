import { m } from '$lib/paraglide/messages';
import type { ReportReason, ReportStatus } from './reports';

export const reasonLabel = (reason: ReportReason) =>
  ({
    spam: m.report_reason_spam,
    harassment: m.report_reason_harassment,
    inappropriate_content: m.report_reason_inappropriate_content,
    no_show: m.report_reason_no_show,
    other: m.report_reason_other,
  })[reason]();

export const reportStatusLabel = (status: ReportStatus) =>
  ({
    open: m.report_status_open,
    reviewing: m.report_status_reviewing,
    resolved: m.report_status_resolved,
    dismissed: m.report_status_dismissed,
  })[status]();
