import { cardPictures } from './card-pictures';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import { readPreview } from '@mesaaberta/core/server/reads/preview';
import type { RequestEvent } from '@sveltejs/kit';
import { readViaApi } from '../api-read';

type Preview = Awaited<ReturnType<typeof readPreview>>;
type PreviewTable = Preview['tables'][number];

// JSON turned the dates into strings; the page gets them as dates either way.
const revive = (table: PreviewTable): PreviewTable => ({
  ...table,
  startsAt: new Date(table.startsAt),
  until: table.until ? new Date(table.until) : null,
  publishedAt: table.publishedAt ? new Date(table.publishedAt) : null,
});

export const read = async ({ locals }: RequestEvent) => {
  // No database yet (see the README): the page still renders, with nothing to list.
  if (!locals.db) return { tables: [], newTables: [], now: new Date() };

  // The same rounded instant the query used, so "Aberta há…" agrees with the list it labels.
  const now = publicReadNow();
  try {
    // Through the api Worker when `api_reads_preview` is on for the signed-in person (visitors
    // stay here: a flag needs someone to target); here otherwise.
    const profile = await locals.getProfile();
    const remote = profile
      ? await readViaApi<Preview>(locals, 'api_reads_preview', profile, '/v1/reads/preview')
      : null;
    const preview = remote
      ? {
          tables: remote.tables.map(revive),
          // An api Worker older than this field answers without it.
          newTables: (remote.newTables ?? []).map(revive),
        }
      : await readPreview(locals.db, now);

    const withImage = (table: PreviewTable) => cardPictures(supabaseUrlOf(locals.env))(table);
    return {
      tables: preview.tables.map(withImage),
      newTables: preview.newTables.map(withImage),
      now,
    };
  } catch (error) {
    // The landing page is still worth showing without the preview.
    locals.log.error('home: could not list upcoming tables', { error });
    return { tables: [], newTables: [], now };
  }
};
