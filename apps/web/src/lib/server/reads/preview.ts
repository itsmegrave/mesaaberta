import { cardPictures } from './card-pictures';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import type { readPreview } from '@mesaaberta/core/server/reads/preview';
import type { RequestEvent } from '@sveltejs/kit';
import { readFromApi } from '../api-read';

type Preview = Awaited<ReturnType<typeof readPreview>>;
type PreviewTable = Preview['tables'][number];

// JSON turned the dates into strings; the page gets them as dates.
const revive = (table: PreviewTable): PreviewTable => ({
  ...table,
  startsAt: new Date(table.startsAt),
  until: table.until ? new Date(table.until) : null,
  publishedAt: table.publishedAt ? new Date(table.publishedAt) : null,
});

export const read = async ({ locals }: RequestEvent) => {
  // The same rounded instant the query used, so "Aberta há…" agrees with the list it labels.
  const now = publicReadNow();
  try {
    // The api reads the preview, for visitors too.
    const user = await locals.getUser();
    const remote = await readFromApi<Preview>(locals, user?.id ?? null, '/v1/reads/preview');
    const preview = {
      tables: remote.tables.map(revive),
      // An api Worker older than this field answers without it.
      newTables: (remote.newTables ?? []).map(revive),
    };

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
