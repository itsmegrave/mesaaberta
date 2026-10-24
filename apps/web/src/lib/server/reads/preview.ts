import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readPreview } from '@mesaaberta/core/server/reads/preview';
import type { RequestEvent } from '@sveltejs/kit';
import { readViaApi } from '../api-read';

export const read = async ({ locals }: RequestEvent) => {
  // No database yet (see the README): the page still renders, with nothing to list.
  if (!locals.db) return { tables: [] };

  try {
    // Through the api Worker when `api_reads_preview` is on for the signed-in person (visitors
    // stay here: a flag needs someone to target); here otherwise.
    const profile = await locals.getProfile();
    const remote = profile
      ? await readViaApi<Awaited<ReturnType<typeof readPreview>>>(
          locals,
          'api_reads_preview',
          profile,
          '/v1/reads/preview',
        )
      : null;
    // JSON turned the two dates into strings; the page gets them as dates either way.
    const { tables } = remote
      ? {
          tables: remote.tables.map((table) => ({
            ...table,
            startsAt: new Date(table.startsAt),
            until: table.until ? new Date(table.until) : null,
          })),
        }
      : await readPreview(locals.db, new Date());

    return {
      tables: tables.map(({ imagePath, ...table }) => ({
        ...table,
        imageUrl: imageUrl(supabaseUrlOf(locals.env), imagePath),
      })),
    };
  } catch (error) {
    // The landing page is still worth showing without the preview.
    locals.log.error('home: could not list upcoming tables', { error });
    return { tables: [] };
  }
};
