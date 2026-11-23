// How a daily crowdfunding import run (`crowdfunding_import_runs`) ended, or `running` while a
// worker holds its lease.
export const IMPORT_RUN_STATUSES = ['running', 'complete', 'partial', 'failed'] as const;
export type ImportRunStatus = (typeof IMPORT_RUN_STATUSES)[number];
