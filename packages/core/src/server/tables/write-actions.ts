import { z } from 'zod';
import '../../forms/zod-codes';
import { tableInputSchema, type TableInput } from '../../tables/schema';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { createTable, disableTable, updateTable } from './write';

/** The image the web Worker already stored, as a path in the bucket (never a URL, never a file). */
const imagePath = z
  .string()
  .max(300)
  .regex(/^[A-Za-z0-9/_.-]+$/)
  .nullable()
  .default(null);

/**
 * What a GM does to a table's own record, by name. The web Worker validates the form, stores the
 * image and resolves the postal code; these take the result (`TableInput` and the stored image's
 * path) and run the service. The web form actions and the api route (`/v1/table-writes`) both run
 * the same services. Each answers the `eventIds` to dispatch after the response.
 */
export const tableWriteActions = {
  create: {
    schema: z.object({
      input: tableInputSchema,
      imagePath,
      draft: z.boolean().default(false),
    }),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      _slug: string,
      { input, imagePath, draft }: { input: TableInput; imagePath: string | null; draft: boolean },
    ) => {
      const created = await createTable(db, actor, input, { imagePath, draft });
      return { eventIds: [created.eventId], slug: created.slug, draft: created.draft };
    },
  },
  update: {
    schema: z.object({ input: tableInputSchema, imagePath }),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      { input, imagePath }: { input: TableInput; imagePath: string | null },
    ) => {
      const { eventId } = await updateTable(db, actor, slug, input, {
        imagePath: imagePath ?? undefined,
      });
      return { eventIds: eventId ? [eventId] : [], slug };
    },
  },
  disable: {
    schema: z.object({}),
    apply: async (db: AnyDb, actor: Actor | null, slug: string) => {
      const { eventId } = await disableTable(db, actor, slug);
      return { eventIds: [eventId], slug };
    },
  },
};

export type TableWriteActionName = keyof typeof tableWriteActions;
