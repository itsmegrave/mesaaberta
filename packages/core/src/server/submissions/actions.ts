import { z } from 'zod';
import '../../forms/zod-codes';
import { crowdfundingFormSchema } from '../../crowdfunding/schema';
import { editPartnerSchema } from '../../partners/schema';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { addCrowdfunding } from '../crowdfunding/service';
import { addPartner, updatePartner } from '../partners/service';

/** A file the web Worker already stored, as a path in the bucket (never a URL, never a file). */
const storedPath = z
  .string()
  .max(300)
  .regex(/^[A-Za-z0-9/_.-]+$/);

type PartnerInput = Parameters<typeof addPartner>[2];
type CrowdfundingInput = Parameters<typeof addCrowdfunding>[2];

/**
 * What a member submits, by name: a partner (new or edited) and a crowdfunding campaign. The web
 * Worker validates the form, fetches and stores the picture; these take the validated input and the
 * stored path and run the same services. The web form actions and the api route
 * (`/v1/submissions`) both run these. Each answers `eventIds` to dispatch after the response.
 */
export const submissionActions = {
  partnerAdd: {
    schema: z.object({ input: editPartnerSchema, logoPath: storedPath }),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      _id: string,
      { input, logoPath }: { input: PartnerInput; logoPath: string },
    ) => {
      const { eventId } = await addPartner(db, actor, input, { logoPath });
      return { eventIds: [eventId] };
    },
  },
  partnerUpdate: {
    schema: z.object({ input: editPartnerSchema, logoPath: storedPath.nullable().default(null) }),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      id: string,
      { input, logoPath }: { input: PartnerInput; logoPath: string | null },
    ) => {
      const { eventId, replacedLogo } = await updatePartner(db, actor, id, input, { logoPath });
      return { eventIds: [eventId], replacedLogo };
    },
  },
  crowdfundingAdd: {
    schema: z.object({
      input: crowdfundingFormSchema,
      imagePath: storedPath.nullable().default(null),
    }),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      _id: string,
      { input, imagePath }: { input: CrowdfundingInput; imagePath: string | null },
    ) => {
      const { eventId } = await addCrowdfunding(db, actor, input, { imagePath });
      return { eventIds: [eventId] };
    },
  },
};

export type SubmissionActionName = keyof typeof submissionActions;
