/**
 * What a partner is, from a closed list: a partner picks one to MAX_PARTNER_TYPES of them, they show
 * under its name on the card and filter `/partners`. The slugs are stored (`partners.types`) and travel in
 * the address (`/partners?type=publisher`); the labels are in the messages. Mirror the list in the
 * `partners_types_known` check on `partners`, and add new kinds at the end.
 */
export const PARTNER_TYPES = [
  'publisher',
  'shop',
  'content',
  'podcast',
  'collective',
  'community',
  'event',
  'venue',
  'art',
  'translation',
  'platform',
  'other',
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const MAX_PARTNER_TYPES = 3;

export const isPartnerType = (value: unknown): value is PartnerType =>
  (PARTNER_TYPES as readonly unknown[]).includes(value);

/** The picked kinds in the list's order, each once, so the same pick is always stored the same way. */
export const orderedTypes = (picked: readonly string[]): PartnerType[] =>
  PARTNER_TYPES.filter((type) => picked.includes(type));
