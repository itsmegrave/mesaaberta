import { readRemoteImage } from '../../crowdfunding/link-preview';
import { connectionStringFrom, createDb, type DatabaseEnv } from '../../db/client';
import { IMAGE_BUCKET, detectImageType, storeImage } from '../../images';
import type { Logger } from '../../logger';
import { isInside, serverStorage, type BucketStorage } from '../../storage';
import {
  findSystemLogo,
  logoDevKeys,
  type FinderDeps,
  type LogoCandidate,
  type LogoSearch,
} from './finder';
import { LOGO_FOLDER, nextSystemsToSearch, recordSearch, type recordSchema } from './service';
import type { z } from 'zod';

/**
 * The logo search, in the background: every ten minutes the worker's cron searches the next few
 * systems nobody has searched yet, stores what it finds and records it as `pending` (or `missing`,
 * with why) for an admin to review at `/admin/catalog/logos`. It runs until no system is left, and
 * starts again on its own when an admin sends systems back to the search. Nothing is public until an
 * admin approves it.
 */
export const LOGO_SEARCH_CRON = '*/10 * * * *';
/** Systems one run searches: about a minute of lookups, well inside a cron's time. */
export const LOGO_BACKGROUND_BATCH = 10;

export type LogoSearchEnv = DatabaseEnv & {
  /** "off" stops the background search (a kill switch). Anything else, or unset, runs it. */
  LOGO_SEARCH?: string;
};

const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

/** Copies the candidate's picture into our storage. Null when it cannot be read or is not an image we take. */
export async function storeLogoCandidate(
  storage: BucketStorage,
  candidate: LogoCandidate,
  deps: FinderDeps,
  log?: Pick<Logger, 'warn'>,
) {
  const bytes = await readRemoteImage(candidate.imageUrl, deps);
  const contentType = bytes && detectImageType(bytes);
  if (!bytes || !contentType) return null;
  return storeImage(
    storage,
    {
      bytes,
      contentType,
      path: `${LOGO_FOLDER}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`,
    },
    log,
  );
}

/** What gets recorded for one system's search: the stored find, or why there is none. */
export function searchRecord(
  systemId: string,
  search: LogoSearch,
  path: string | null,
): z.infer<typeof recordSchema> {
  const candidate = search.candidate;
  const found =
    candidate && path
      ? {
          path,
          method: candidate.method,
          confidence: candidate.confidence,
          imageUrl: candidate.imageUrl,
          sourcePage: candidate.sourcePage,
          attribution: candidate.attribution?.slice(0, 500) ?? null,
          license: candidate.license?.slice(0, 200) ?? null,
          note: candidate.note,
          wikidataId: search.wikidataId,
        }
      : null;
  const reason = found
    ? null
    : candidate
      ? `image_unreadable: ${candidate.imageUrl}`.slice(0, 200)
      : search.reason;
  return { systemId, found, reason, wikidataId: search.wikidataId };
}

type Deps = {
  log: Logger;
  open?: typeof createDb;
  find?: typeof findSystemLogo;
  /** The bucket the pictures go to; by default the table-images bucket with the server key. */
  storage?: BucketStorage | null;
  finder?: FinderDeps;
  batch?: number;
};

/**
 * One run of the background search. Stops early, recording nothing for the rest, when Wikidata
 * does not answer (an outage or a rate limit), so the next run tries those systems again. Never
 * throws for a single system's trouble; a database failure does, for the cron to log.
 */
export async function runLogoSearch(
  env: LogoSearchEnv,
  { log, open = createDb, find = findSystemLogo, storage, finder = {}, batch }: Deps,
) {
  if (env.LOGO_SEARCH === 'off') return { searched: 0, found: 0 };
  const connectionString = connectionStringFrom(env);
  const bucket = storage === undefined ? serverStorage(env, IMAGE_BUCKET) : storage;
  if (!connectionString || !bucket) return { searched: 0, found: 0 };
  const deps: FinderDeps = { logoDev: logoDevKeys(env), ...finder };

  const { db, close } = open(connectionString);
  let searched = 0;
  let found = 0;
  try {
    const systems = await nextSystemsToSearch(db, batch ?? LOGO_BACKGROUND_BATCH);
    for (const system of systems) {
      const search = await find(system.name, deps);
      if (search.reason === 'lookup_failed') {
        log.warn('system_logos.lookup_failed', {
          code: 'lookup_failed',
          retryInSeconds: search.retryAfter,
        });
        break;
      }
      let path: string | null = null;
      if (search.candidate) {
        try {
          path = await storeLogoCandidate(bucket, search.candidate, deps, log);
        } catch (error) {
          // Storage refused: stop, so the system is searched again rather than marked unreadable.
          log.warn('system_logos.store_failed', { code: 'store_failed', error });
          break;
        }
      }
      const { unused } = await recordSearch(db, searchRecord(system.id, search, path));
      if (unused && isInside(unused, LOGO_FOLDER)) await bucket.remove([unused]);
      searched += 1;
      if (path) found += 1;
    }
  } finally {
    await close();
  }
  if (searched > 0) log.info('system_logos.searched', { searched, found });
  return { searched, found };
}
