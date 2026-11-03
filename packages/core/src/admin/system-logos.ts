import { z } from 'zod';

/** What the logo search left for a system; only `approved` is ever shown to the public. */
export const LOGO_STATUSES = ['pending', 'approved', 'rejected', 'missing'] as const;
export type LogoStatus = (typeof LOGO_STATUSES)[number];

/** An admin's decision on one system's logo. */
export const logoDecisionSchema = z.object({ systemId: z.uuid() });
/** A form with nothing in it: the search step and "approve the sure ones". */
export const emptySchema = z.object({});

/** The status in the address, pending when it is missing or not one. */
export const logoStatusOf = (value: string | null): LogoStatus =>
  LOGO_STATUSES.includes(value as LogoStatus) ? (value as LogoStatus) : 'pending';
