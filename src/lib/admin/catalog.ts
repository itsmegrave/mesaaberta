import '$lib/forms/zod-codes';
import { z } from 'zod';
import { SUGGESTION_NAME } from '$lib/tables/catalog';

// Shared by the admin forms (which show the limits) and their actions (which decide).
z.config({ jitless: true });

export const CATALOG_KINDS = ['platform', 'tag'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

const kind = z.enum(CATALOG_KINDS);
const name = z.string().trim().min(SUGGESTION_NAME.min).max(SUGGESTION_NAME.max);

/** Approve, reject and disable: an entry, and which catalog it is in. */
export const entrySchema = z.object({ kind, id: z.uuid() });
/** The new name; the slug follows it. */
export const renameSchema = entrySchema.extend({ name });
/** Fold `id` into `into`: the tables move over and `id` stays as a record. */
export const mergeSchema = z
  .object({ kind, id: z.uuid(), into: z.uuid() })
  .refine((value) => value.id !== value.into, { path: ['into'], message: 'same' });
/** A new, approved entry. */
export const createSchema = z.object({ kind, name });

/** `?page=N`: a positive whole number, anything else is the first page. */
export const pageNumber = (value: string | null) =>
  value && /^[1-9]\d{0,6}$/.test(value) ? Number(value) : 1;
