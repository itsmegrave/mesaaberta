import { z } from 'zod';
import '$lib/forms/zod-codes';
import { imageFile, requiredImageFile } from '$lib/forms/files';
import {
  handleUrl,
  isNetwork,
  NETWORKS,
  parseHandle,
  parseSocialUrl,
  type Network,
} from '$lib/profile/social-links';

// Zod's JIT uses `Function`, which strict CSP blocks (and reports even when Zod catches the error).
z.config({ jitless: true });

// Mirror the length checks on partners.
export const PARTNER_LIMITS = {
  name: 60,
  description: 140,
  couponCode: 32,
  couponDescription: 140,
} as const;

/** At most this many network links on a card, besides the site. */
export const MAX_PARTNER_LINKS = 6;

/** The networks a card can link to. The site has a field of its own. */
export const PARTNER_NETWORKS = NETWORKS.filter(
  (network): network is Exclude<Network, 'website'> => network !== 'website',
);

const DISCORD_HOSTS = ['discord.gg', 'discord.com', 'discordapp.com'];

/**
 * The address a network row opens, or null if what was typed is not valid for it. A card's icon is a
 * link, so Discord takes an invite address (there is no profile address to build from a handle); the
 * other networks take a handle or the network's own address, like a profile.
 */
export function partnerLinkUrl(network: Network, raw: string): string | null {
  if (network === 'website') return parseSocialUrl(raw);
  if (network === 'discord') {
    const url = parseSocialUrl(raw);
    if (!url) return null;
    const host = new URL(url).hostname.replace(/^www\./, '');
    return DISCORD_HOSTS.includes(host) ? url : null;
  }
  const handle = parseHandle(network, raw);
  return handle ? handleUrl(network, handle) : null;
}

const optionalText = (max: number) => z.string().trim().max(max, 'too_long').default('');

const optionalAddress = z
  .string()
  .trim()
  .default('')
  .refine((value) => value === '' || parseSocialUrl(value) !== null, 'invalid_url');

// The links travel as two parallel lists (`linkNetwork`, `linkUrl`), like the profile's, so a plain
// form post with JavaScript off carries them too.
const fields = {
  name: z.string().trim().min(1, 'required').max(PARTNER_LIMITS.name, 'too_long'),
  description: optionalText(PARTNER_LIMITS.description),
  siteUrl: optionalAddress,
  backlinkUrl: optionalAddress,
  couponCode: optionalText(PARTNER_LIMITS.couponCode),
  couponDescription: optionalText(PARTNER_LIMITS.couponDescription),
  linkNetwork: z.array(z.string()).default([]),
  linkUrl: z.array(z.string()).default([]),
};

type Fields = {
  siteUrl: string;
  couponCode: string;
  couponDescription: string;
  linkNetwork: string[];
  linkUrl: string[];
};

function checkLinks(
  { siteUrl, couponCode, couponDescription, linkNetwork, linkUrl }: Fields,
  ctx: z.core.$RefinementCtx<unknown>,
) {
  const add = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: 'custom', message, path });

  if (couponDescription !== '' && couponCode === '') add('needs_code', ['couponCode']);

  if (linkNetwork.length !== linkUrl.length) {
    add('invalid', ['linkUrl']);
    return;
  }
  const filled = linkUrl.filter((url) => url.trim() !== '').length;
  if (filled > MAX_PARTNER_LINKS) {
    add('too_many', ['linkUrl']);
    return;
  }

  const seen = new Set<string>();
  linkUrl.forEach((raw, index) => {
    // A row left empty is skipped, but it still counts for the position of the ones after it.
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

  // A card has to lead somewhere: the site, or at least one network.
  if (siteUrl === '' && filled === 0) add('need_a_link', ['siteUrl']);
}

/** Sending a partner: the logo is required. */
export const newPartnerSchema = z
  .object({ ...fields, logo: requiredImageFile })
  .superRefine(checkLinks);

/** Editing one: leaving the logo empty keeps the current one. */
export const editPartnerSchema = z.object({ ...fields, logo: imageFile }).superRefine(checkLinks);

export type NewPartnerInput = z.output<typeof newPartnerSchema>;
export type EditPartnerInput = z.output<typeof editPartnerSchema>;

/** What the service stores: the form without the logo file. */
export type PartnerInput = Omit<EditPartnerInput, 'logo'>;

export const NEW_PARTNER_VALUES = {
  name: '',
  description: '',
  siteUrl: '',
  backlinkUrl: '',
  couponCode: '',
  couponDescription: '',
  linkNetwork: [] as string[],
  linkUrl: [] as string[],
  logo: undefined,
};

/** The links to store, in the order sent: empty rows dropped, addresses built. Validate first. */
export function partnerLinks({
  linkNetwork,
  linkUrl,
}: Pick<PartnerInput, 'linkNetwork' | 'linkUrl'>): { network: Network; url: string }[] {
  return linkUrl.flatMap((raw, index) => {
    const network = linkNetwork[index];
    if (!isNetwork(network) || network === 'website') return [];
    const url = partnerLinkUrl(network, raw);
    return url ? [{ network, url }] : [];
  });
}

/** An admin sending a partner back: the reason is told to the submitter, with an optional note. */
export const PARTNER_REMOVAL_NOTE_MAX = 1000;
