import { loadRead } from '#lib/server/reads/load.js';
import { tableSafetyEnabled } from '#lib/server/tables/safety-enabled.js';
import type { TableFormValues } from '#lib/tables/form-values.js';
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
import { NEW_TABLE_VALUES } from '#lib/tables/form-values.js';
import { directoryEnabled } from '#lib/server/directories/flags.js';
import { checkLimitViaApi, readPlaceOptions } from '#lib/server/tables/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { locals, url, cookies } = event;
  const user = await requireUser(locals, url);
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
  // "Abrir uma mesa deste sistema" (`?system=<slug>`, from a system's page) picks the system; only
  // an approved one, anything else is ignored.
  const wanted = url.searchParams.get('system');
  const presetSystem = catalogRead.systems.find(
    (system) => system.slug === wanted && !('pending' in system),
  )?.slug;
  // "Abrir mesa aqui" on a place's page (`?place=<slug>`) picks that place, in person; only a
  // listed one, and only while the places are on.
  const places = (await directoryEnabled(locals, 'places'))
    ? await readPlaceOptions(locals, user.id)
    : null;
  const presetPlace = places?.find((place) => place.slug === url.searchParams.get('place'))?.slug;
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
            plannedSessions: input.plannedSessions === null ? '' : String(input.plannedSessions),
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
            placeSlug: source.placeSlug,
            safetyTools: input.safetyTools ?? [],
            contentRating: (input.contentRating ?? '') as TableFormValues['contentRating'],
          }
        : {
            ...NEW_TABLE_VALUES,
            ...(presetSystem ? { systemSlug: presetSystem } : {}),
            ...(presetPlace ? { modality: 'in_person' as const, placeSlug: presetPlace } : {}),
            timezone: await timezoneOf(locals, cookies),
          },
    ),
    systems: catalogRead.systems,
    catalog: catalogRead.catalog,
    catalogRead,
    places,
    safety: await tableSafetyEnabled(locals, await locals.getProfile()),
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
        if (!profile) error(403, 'Forbidden');
        // The api Worker writes the table, or its copy.
        const written = sourceSlug
          ? await requireApiWrite(
              locals,
              profile,
              `/v1/tables/${encodeURIComponent(sourceSlug)}/duplicate`,
              { input, imagePath: imagePath ?? null, draft, requestKey },
            )
          : await writeViaApi(locals, profile, '/v1/table-writes', {
              input,
              imagePath: imagePath ?? null,
              draft,
            });
        return { slug: String(written.body.slug), draft: written.body.draft === true };
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
          await checkLimitViaApi(locals, actor.id, draft ? 'draft' : 'table');
      },
      // A draft goes to where its GM manages it, which says it is not public yet.
      (slug, draft) => (draft ? `/t/${slug}/manage` : `/t/${slug}`),
    );
  },
};
