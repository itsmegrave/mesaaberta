import { loadRead } from '#lib/server/reads/load.js';
import { z } from 'zod';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import type { loadTableForDuplication } from '@mesaaberta/core/server/tables/duplicate';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { minutesToHours } from '@mesaaberta/core/tables/format';
import { error, isHttpError } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { requireApi, requireApiWrite } from '#lib/server/api-required.js';
import { timezoneOf } from '#lib/server/time.js';
import { handleTableForm } from '#lib/server/tables/form-action.js';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { createTable } from '@mesaaberta/core/server/tables/write';
import {
  TABLE_CREATION_LIMIT,
  TABLE_DRAFT_LIMIT,
  checkRateLimit,
} from '@mesaaberta/core/server/rate-limit';
import { NEW_TABLE_VALUES } from '#lib/tables/form-values.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { locals, url, cookies } = event;
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  locals.track('gm_onboarding_started', user.id, {
    gm_user_id: user.id,
    onboarding_step: 'table_setup_start',
    country_market: 'BR',
  });

  // The GM's own pending suggestions are offered too.
  const catalogRead = await loadRead(event, 'catalog');

  const sourceSlug = url.searchParams.get('duplicate');
  const source = sourceSlug ? await duplicationSource(locals, sourceSlug) : null;
  const input = source?.input;
  return {
    duplication: source
      ? {
          sourceSlug: source.sourceSlug,
          title: input!.title,
          requestKey: crypto.randomUUID(),
          heldCatalog: source.heldCatalog,
          imageUrl: imageUrl(supabaseUrlOf(locals.env), source.imagePath),
        }
      : null,
    form: initialForm(
      input
        ? {
            ...NEW_TABLE_VALUES,
            ...input,
            extraInfo: input.extraInfo ?? '',
            welcomeMessage: input.welcomeMessage ?? '',
            minPlayers: input.minPlayers === null ? '' : String(input.minPlayers),
            durationHours: minutesToHours(input.durationMinutes),
            repeat:
              input.recurrence === 'FREQ=WEEKLY;INTERVAL=2'
                ? 'biweekly'
                : input.recurrence
                  ? 'weekly'
                  : '',
            until: input.untilLocalDate ?? '',
            locationArea: input.locationArea ?? '',
            joinDetails: input.joinDetails ?? '',
            postalCode: input.postalCode ?? '',
          }
        : { ...NEW_TABLE_VALUES, timezone: await timezoneOf(locals, cookies) },
    ),
    systems: catalogRead.systems,
    catalog: catalogRead.catalog,
    catalogRead,
  };
};

async function duplicationSource(locals: App.Locals, slug: string) {
  try {
    const actor = await locals.getProfile();
    if (!actor) error(403, 'Forbidden');
    return await requireApi<Awaited<ReturnType<typeof loadTableForDuplication>>>(
      locals,
      actor,
      `/v1/tables/${encodeURIComponent(slug)}/duplication`,
    );
  } catch (cause) {
    if (cause instanceof Forbidden) error(403, 'Forbidden');
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
}

export const actions: Actions = {
  default: async (event) => {
    const { locals } = event;
    // Who is asking comes before whether we can serve them.
    await requireUser(locals, event.url);
    if (!locals.db) error(503, 'Database not configured');
    const db = locals.db;
    const sourceSlug = event.url.searchParams.get('duplicate');
    // Only the zone comes from the source. A retry can find it deleted or moderated: the api still
    // answers that replay with the copy that exists, and refuses anything else.
    const source = sourceSlug
      ? await duplicationSource(locals, sourceSlug).catch((cause) => {
          if (isHttpError(cause) && (cause.status === 403 || cause.status === 404)) return null;
          throw cause;
        })
      : null;
    let requestKey: string | undefined;

    return handleTableForm(
      { ...event, formTimezone: source?.input.timezone },
      async (input, imagePath, draft) => {
        const profile = await locals.getProfile();
        // Through the api Worker when `api_table_write` is on for this person; here otherwise.
        if (sourceSlug && !profile) error(403, 'Forbidden');
        const remote = sourceSlug
          ? await requireApiWrite(
              locals,
              profile!,
              `/v1/tables/${encodeURIComponent(sourceSlug)}/duplicate`,
              { input, imagePath: imagePath ?? null, draft, requestKey },
            )
          : profile
            ? await writeViaApi(locals, 'api_table_write', profile, '/v1/table-writes', {
                input,
                imagePath: imagePath ?? null,
                draft,
              })
            : null;
        const created = remote
          ? {
              slug: String(remote.body.slug),
              draft: remote.body.draft === true,
              eventId: remote.eventIds[0],
            }
          : await createTable(db, profile, input, { imagePath, draft });
        // After the commit and the response, so the visitor never waits for a handler.
        locals.afterResponse((db) =>
          dispatchEvent(db, handlersFor(event.locals.env), created.eventId, new Date(), locals.log),
        );
        return created;
      },
      // A limited person is told before their image is stored. `createTable` checks again, under a lock.
      async (draft, data) => {
        if (sourceSlug) {
          const key = z.uuid().safeParse(data.get('duplicationRequestKey'));
          if (!key.success) error(400, 'Invalid duplication request');
          requestKey = key.data;
        }
        const actor = await locals.getProfile();
        // The API checks limits only for a new copy, after its idempotency lookup.
        if (actor && !sourceSlug)
          await checkRateLimit(db, actor.id, draft ? TABLE_DRAFT_LIMIT : TABLE_CREATION_LIMIT);
      },
      // A draft goes to where its GM manages it, which says it is not public yet.
      (slug, draft) => (draft ? `/tables/${slug}/manage` : `/tables/${slug}`),
    );
  },
};
