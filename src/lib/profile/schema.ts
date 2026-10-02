import { z } from 'zod';
import { usernameProblem } from './username';
import { MAX_SOCIAL_LINKS, isNetwork, parseSocialUrl, type Network } from './social-links';
import { isTimeZone } from '$lib/time/timezone';

// Zod compiles a faster parser with `new Function` when it can. In the browser our Content-Security-Policy
// forbids `eval`, so Zod would try it and be reported as a violation on every page that loads it. The
// plain parser is fast enough for a form.
z.config({ jitless: true });

// The profile form, for the browser (instant feedback) and the server (which decides). Every
// message is a short code, not text: the form turns a code into a translated sentence.

export const PROFILE_LIMITS = {
  name: 80,
  /** The own words someone picks "Outro" to write. */
  gender: 40,
  city: 80,
} as const;

/**
 * The age ranges, youngest first. A range is enough to find a table, so the exact age is not asked
 * (LGPD art. 6º, III). Optional. Keep in step with the `age_range` enum in the database.
 */
export const AGE_RANGES = ['13_17', '18_24', '25_34', '35_44', '45_54', '55_plus'] as const;

export type AgeRange = (typeof AGE_RANGES)[number];

/**
 * The gender options, in the order the form lists them. Optional: no answer is the default. A
 * person who is not in the list picks `other` and may write their own words (`genderOther`).
 * Keep in step with the `gender_identity` enum in the database.
 */
export const GENDER_OPTIONS = [
  'woman',
  'man',
  'trans_woman',
  'trans_man',
  'non_binary',
  'agender',
  'genderfluid',
  'travesti',
  'other',
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];

// The links travel as two parallel lists (`linkNetwork`, `linkUrl`) rather than a list of objects,
// so a plain form post with JavaScript off carries them too.
export const profileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .superRefine((value, ctx) => {
        const problem = usernameProblem(value);
        if (problem) ctx.addIssue({ code: 'custom', message: problem });
      }),
    name: z.string().trim().max(PROFILE_LIMITS.name, 'too_long').default(''),
    ageRange: z.union([z.enum(AGE_RANGES), z.literal('')], 'invalid').default(''),
    gender: z.union([z.enum(GENDER_OPTIONS), z.literal('')], 'invalid').default(''),
    genderOther: z.string().trim().max(PROFILE_LIMITS.gender, 'too_long').default(''),
    city: z.string().trim().max(PROFILE_LIMITS.city, 'too_long').default(''),
    // An IANA zone, or empty for "not picked yet" (the browser's is used meanwhile).
    timezone: z
      .string()
      .trim()
      .refine((zone) => zone === '' || isTimeZone(zone), 'invalid')
      .default(''),
    linkNetwork: z.array(z.string()).default([]),
    linkUrl: z.array(z.string()).default([]),
  })
  .superRefine(({ linkNetwork, linkUrl }, ctx) => {
    if (linkNetwork.length !== linkUrl.length) {
      ctx.addIssue({ code: 'custom', message: 'invalid', path: ['linkUrl'] });
      return;
    }

    const filled = linkUrl.filter((url) => url.trim() !== '').length;
    if (filled > MAX_SOCIAL_LINKS) {
      ctx.addIssue({ code: 'custom', message: 'too_many', path: ['linkUrl'] });
      return;
    }

    const seen = new Set<string>();
    linkUrl.forEach((raw, index) => {
      // A row left empty is skipped, but it still counts for the position of the ones after it.
      if (raw.trim() === '') return;

      if (!isNetwork(linkNetwork[index])) {
        ctx.addIssue({ code: 'custom', message: 'invalid_network', path: ['linkNetwork', index] });
        return;
      }

      const url = parseSocialUrl(raw);
      if (!url) {
        ctx.addIssue({ code: 'custom', message: 'invalid_url', path: ['linkUrl', index] });
      } else if (seen.has(url)) {
        ctx.addIssue({ code: 'custom', message: 'duplicate', path: ['linkUrl', index] });
      } else {
        seen.add(url);
      }
    });
  });

export type ProfileInput = z.infer<typeof profileSchema>;

/** The links to store, in the order sent: empty rows dropped, addresses normalised. Validate first. */
export function profileLinks({
  linkNetwork,
  linkUrl,
}: Pick<ProfileInput, 'linkNetwork' | 'linkUrl'>): { network: Network; url: string }[] {
  return linkUrl.flatMap((raw, index) => {
    const url = parseSocialUrl(raw);
    const network = linkNetwork[index];

    return url && isNetwork(network) ? [{ network, url }] : [];
  });
}

export const PROFILE_DEFAULTS: ProfileInput = {
  username: '',
  name: '',
  ageRange: '',
  gender: '',
  genderOther: '',
  city: '',
  timezone: '',
  linkNetwork: [],
  linkUrl: [],
};
