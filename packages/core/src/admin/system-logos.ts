import { z } from 'zod';
import { requiredImageFile } from '../forms/files';

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

/** A logo an admin sends by hand, with where it comes from (logos are trademarks). */
export const logoUploadSchema = z.object({
  systemId: z.uuid(),
  sourcePage: z
    .string()
    .trim()
    .min(1, 'required')
    .max(2_000, 'too_big')
    .pipe(z.url({ protocol: /^https$/, message: 'invalid_url' })),
  attribution: z.string().trim().max(500, 'too_big'),
  logo: requiredImageFile,
});
