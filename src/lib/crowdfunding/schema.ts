import { z } from 'zod';
import '$lib/forms/zod-codes';
import { imageFile } from '$lib/forms/files';
import { normalizeCampaignUrl } from './url';

// Zod's JIT uses `Function`, which strict CSP blocks (and reports even when Zod catches the error).
z.config({ jitless: true });

// Mirror the length checks on crowdfundings.
export const CROWDFUNDING_LIMITS = { name: 120, owner: 80, url: 2048 } as const;

const isDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/** What the member types when adding a campaign. The platform is not asked: it comes from the link. */
export const crowdfundingFormSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(CROWDFUNDING_LIMITS.url)
      .refine((value) => normalizeCampaignUrl(value) !== null, 'invalid_url'),
    name: z.string().trim().min(1).max(CROWDFUNDING_LIMITS.name),
    owner: z.string().trim().min(1).max(CROWDFUNDING_LIMITS.owner),
    startsOn: z.string().refine(isDate, 'invalid'),
    endsOn: z.string().refine(isDate, 'invalid'),
    // Checked here so the form refuses it before uploading; the server still reads its bytes.
    image: imageFile,
  })
  .refine(
    (value) => !isDate(value.startsOn) || !isDate(value.endsOn) || value.endsOn >= value.startsOn,
    {
      path: ['endsOn'],
      message: 'before_start',
    },
  );

export type CrowdfundingFormInput = z.output<typeof crowdfundingFormSchema>;

/** An admin taking a campaign down: the reason it is told to the submitter, and an optional note. */
export const REMOVAL_NOTE_MAX = 1000;
