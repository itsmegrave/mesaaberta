import { z } from 'zod';
import '@mesaaberta/core/forms/zod-codes';
import { imageFile } from '@mesaaberta/core/forms/files';
import { normalizeCep } from '../location/cep';
import { isNetwork, parseSocialUrl, type Network } from '../profile/social-links';
import { partnerLinkUrl } from '../partners/schema';
import { MAX_PLACE_FEATURES } from './features';
import {
  isPlaceAmenity,
  isPlaceKind,
  MAX_PLACE_LINKS,
  PLACE_LIMITS,
  type PlaceKind,
} from './types';

// Zod's JIT uses `Function`, which strict CSP blocks (and reports even when Zod catches the error).
z.config({ jitless: true });

const optionalText = (max: number) => z.string().trim().max(max, 'too_long').default('');

// The links travel as two parallel lists (`linkNetwork`, `linkUrl`), like a partner's.
const fields = {
  name: z.string().trim().min(1, 'required').max(PLACE_LIMITS.name, 'too_long'),
  kind: z.string().refine(isPlaceKind, 'required'),
  // Required: the city, state and neighbourhood come from it.
  postalCode: z
    .string()
    .trim()
    .min(1, 'required')
    .refine((value) => normalizeCep(value) !== null, 'invalid'),
  street: z.string().trim().min(1, 'required').max(PLACE_LIMITS.street, 'too_long'),
  complement: optionalText(PLACE_LIMITS.complement),
  description: optionalText(PLACE_LIMITS.description),
  openingHours: optionalText(PLACE_LIMITS.openingHours),
  // The tags: catalog slugs (`place_features`), or `new:<name>` for a suggestion. `amenities` is
  // what the form sent before the catalog (the old Comodidades); the api still takes it.
  tags: z.array(z.string().max(60)).default([]),
  amenities: z.array(z.string()).default([]),
  siteUrl: z
    .string()
    .trim()
    .default('')
    .refine((value) => value === '' || parseSocialUrl(value) !== null, 'invalid_url'),
  linkNetwork: z.array(z.string()).default([]),
  linkUrl: z.array(z.string()).default([]),
  // Editing: take the current photo off (a new photo wins over it).
  removeImage: z.boolean().default(false),
};

type Fields = { tags: string[]; amenities: string[]; linkNetwork: string[]; linkUrl: string[] };

function checkLists(
  { tags, amenities, linkNetwork, linkUrl }: Fields,
  ctx: z.core.$RefinementCtx<unknown>,
) {
  const add = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: 'custom', message, path });

  if (!amenities.every(isPlaceAmenity)) add('invalid', ['amenities']);
  if (new Set(tags).size > MAX_PLACE_FEATURES) add('too_many', ['tags']);

  if (linkNetwork.length !== linkUrl.length) {
    add('invalid', ['linkUrl']);
    return;
  }
  if (linkUrl.filter((url) => url.trim() !== '').length > MAX_PLACE_LINKS) {
    add('too_many', ['linkUrl']);
    return;
  }
  const seen = new Set<string>();
  linkUrl.forEach((raw, index) => {
    if (raw.trim() === '') return;
    const network = linkNetwork[index];
    if (!isNetwork(network) || network === 'website') {
      add('invalid_network', ['linkNetwork', index]);
      return;
    }
    const url = partnerLinkUrl(network, raw);
    if (!url) add('invalid_link', ['linkUrl', index]);
    else if (seen.has(url.toLowerCase())) add('duplicate', ['linkUrl', index]);
    else seen.add(url.toLowerCase());
  });
}

/** Sending or editing a place. The photo is optional either way. */
export const placeSchema = z.object({ ...fields, image: imageFile }).superRefine(checkLists);

export type PlaceFormInput = z.output<typeof placeSchema>;

/** The same input without the photo, as the api Worker takes it once web stored the photo. */
export const placeInputSchema = z.object(fields).superRefine(checkLists);

/** What the service stores: the form without the photo file, the kind narrowed. */
export type PlaceInput = Omit<PlaceFormInput, 'image' | 'kind'> & { kind: PlaceKind };

export const NEW_PLACE_VALUES = {
  name: '',
  kind: '',
  postalCode: '',
  street: '',
  complement: '',
  description: '',
  openingHours: '',
  tags: [] as string[],
  amenities: [] as string[],
  siteUrl: '',
  linkNetwork: [] as string[],
  linkUrl: [] as string[],
  removeImage: false,
  image: undefined,
};

/** The links to store, in the order sent: empty rows dropped, addresses built. Validate first. */
export function placeLinks({ linkNetwork, linkUrl }: Pick<PlaceInput, 'linkNetwork' | 'linkUrl'>): {
  network: Exclude<Network, 'website'>;
  url: string;
}[] {
  return linkUrl.flatMap((raw, index) => {
    const network = linkNetwork[index];
    if (!isNetwork(network) || network === 'website') return [];
    const url = partnerLinkUrl(network, raw);
    return url ? [{ network, url }] : [];
  });
}

/** An admin rejecting or removing a place: the reason is told to the submitter, with a note. */
export const PLACE_REMOVAL_NOTE_MAX = 1000;
