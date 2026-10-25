import { REPORT_DETAILS_MAX } from '@mesaaberta/core/moderation/reports';
import { m } from '#lib/paraglide/messages.js';

/** What a report form says for each code the schema or the server answers with. */
export const REPORT_ERRORS: Record<string, () => string> = {
  invalid_value: m.report_err_reason,
  too_big: () => m.report_err_details({ max: REPORT_DETAILS_MAX }),
  already_reported: m.report_err_already,
  rate_limited: m.report_err_rate_limited,
  forbidden: m.report_err_forbidden,
  not_found: m.report_err_forbidden,
};

/** The sentence for `code`, the generic one for an unknown code, and nothing without one. */
export const reportError = (code?: string, codes: Record<string, () => string> = REPORT_ERRORS) =>
  code ? (codes[code]?.() ?? m.report_error()) : undefined;
