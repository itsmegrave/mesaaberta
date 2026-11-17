import { sql } from 'drizzle-orm';
import { connectionStringFrom, createDb, type AnyDb, type DatabaseEnv } from './db/client';
import {
  AVATAR_BUCKET,
  IMAGE_BUCKET,
  cacheControlFor,
  compressed,
  detectImageType,
  storageUrlOf,
  type PreparedImage,
} from './images';
import type { Logger } from './logger';
import { serverStorage, type BucketStorage } from './storage';

/**
 * Every column that holds a stored picture's path, and the bucket the file is in. A new one goes
 * here too, or its old PNGs and JPEGs are never turned into WebP.
 */
export const IMAGE_COLUMNS = [
  { table: 'game_tables', column: 'image_path', bucket: IMAGE_BUCKET },
  { table: 'crowdfundings', column: 'image_path', bucket: IMAGE_BUCKET },
  { table: 'places', column: 'image_path', bucket: IMAGE_BUCKET },
  { table: 'system_logos', column: 'path', bucket: IMAGE_BUCKET },
  { table: 'profiles', column: 'avatar_path', bucket: AVATAR_BUCKET },
  { table: 'profiles', column: 'banner_path', bucket: AVATAR_BUCKET },
  { table: 'partners', column: 'logo_path', bucket: AVATAR_BUCKET },
  { table: 'tools', column: 'logo_path', bucket: AVATAR_BUCKET },
] as const;

/** Pictures one run converts: a few seconds of work each, well inside a cron's time. */
export const IMAGE_BACKFILL_BATCH = 5;
/** Leftover originals one run deletes: one Storage call each, so more than conversions. */
export const ORIGINALS_CLEANUP_BATCH = 20;

export type ImageBackfillEnv = DatabaseEnv & {
  /** "off" stops the conversion (a kill switch). Anything else, or unset, runs it. */
  IMAGE_BACKFILL?: string;
};

type Bucket = (typeof IMAGE_COLUMNS)[number]['bucket'];

/**
 * Stored pictures that aren't WebP yet, a few at a time and in random order, so one that keeps
 * failing can't hold the others back. A tool's seeded logo (`/tools/…`) ships with the site and is
 * skipped.
 */
export async function picturesToConvert(db: AnyDb, limit: number) {
  const parts = IMAGE_COLUMNS.map(
    ({ table, column, bucket }) =>
      sql`select ${sql.identifier(column)} as path, ${bucket}::text as bucket from ${sql.identifier(table)}
          where ${sql.identifier(column)} is not null
            and ${sql.identifier(column)} not like '/%'
            and lower(${sql.identifier(column)}) !~ '\\.webp$'`,
  );
  type Row = { path: string; bucket: Bucket };
  const result = await db.execute(
    sql`select path, bucket from (select distinct path, bucket
          from (${sql.join(parts, sql` union all `)}) pictures) found
        order by random() limit ${limit}`,
  );
  // postgres.js answers an array, PGlite (the tests) an object with `rows`.
  return (Array.isArray(result) ? result : (result as { rows: Row[] }).rows) as Row[];
}

/** Points every column that held `from` (in that bucket) at `to`, in one transaction. */
export async function repointPicture(db: AnyDb, bucket: Bucket, from: string, to: string) {
  await db.transaction(async (t) => {
    for (const { table, column, bucket: own } of IMAGE_COLUMNS) {
      if (own !== bucket) continue;
      await t.execute(
        sql`update ${sql.identifier(table)} set ${sql.identifier(column)} = ${to}
            where ${sql.identifier(column)} = ${from}`,
      );
    }
  });
}

/** Whether any picture column (of that bucket) still points at `path`. */
async function stillUsed(db: AnyDb, bucket: Bucket, path: string) {
  const parts = IMAGE_COLUMNS.filter((c) => c.bucket === bucket).map(
    ({ table, column }) =>
      sql`select 1 from ${sql.identifier(table)} where ${sql.identifier(column)} = ${path}`,
  );
  const result = await db.execute(sql`select exists(${sql.join(parts, sql` union all `)}) as used`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    used: boolean;
  }[];
  return rows[0]?.used ?? true;
}

/**
 * Originals an earlier run converted but kept (before this deleted them): a PNG or JPEG in a picture
 * bucket that no row points at any more, next to its `.webp`. Read from Supabase Storage's own
 * table; where there is none (another store, the tests' database) there is nothing to find.
 */
export async function leftoverOriginals(db: AnyDb, limit: number) {
  const buckets = [...new Set(IMAGE_COLUMNS.map((c) => c.bucket))];
  type Row = { path: string; bucket: Bucket };
  try {
    const result = await db.execute(
      sql`select o.name as path, o.bucket_id as bucket from storage.objects o
          where o.bucket_id in (${sql.join(
            buckets.map((b) => sql`${b}`),
            sql`, `,
          )})
            and lower(o.name) ~ '\.(png|jpe?g)$'
            and exists (select 1 from storage.objects w where w.bucket_id = o.bucket_id
                        and w.name = regexp_replace(o.name, '\.[^.]+$', '.webp'))
          limit ${limit * 4}`,
    );
    const rows = (Array.isArray(result) ? result : (result as { rows: Row[] }).rows) as Row[];
    const unused: Row[] = [];
    for (const row of rows) {
      if (unused.length >= limit) break;
      if (!(await stillUsed(db, row.bucket, row.path))) unused.push(row);
    }
    return unused;
  } catch {
    return [];
  }
}

/**
 * Whether Storage already holds `path` in that bucket, read from Supabase Storage's own table. Where
 * there is none (another store, the tests' database) the answer is no, and the picture is converted.
 */
export async function isStored(db: AnyDb, bucket: Bucket, path: string) {
  try {
    const result = await db.execute(
      sql`select exists(select 1 from storage.objects where bucket_id = ${bucket} and name = ${path}) as stored`,
    );
    const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
      stored: boolean;
    }[];
    return rows[0]?.stored === true;
  } catch {
    return false;
  }
}

type Deps = {
  log: Logger;
  open?: typeof createDb;
  /** The bucket a picture goes back to; the server-key storage by default. */
  storage?: (bucket: Bucket) => BucketStorage | null;
  fetcher?: typeof fetch;
  batch?: number;
};

/**
 * One run of the conversion: reads a few stored PNG and JPEG pictures, stores each again as a WebP
 * no bigger than its place needs (`compressed`), points the rows at the new file and deletes the
 * original, which may carry the photo's metadata (EXIF, GPS) and was public. It first deletes the
 * originals earlier runs kept. Runs from the worker's ten-minute cron until nothing is left, and
 * costs two queries when there is nothing to do.
 */
export async function runImageBackfill(
  env: ImageBackfillEnv,
  { log, open = createDb, storage, fetcher = fetch, batch = IMAGE_BACKFILL_BATCH }: Deps,
) {
  const result = { converted: 0, failed: 0, removed: 0 };
  if (env.IMAGE_BACKFILL === 'off') return result;
  const connectionString = connectionStringFrom(env);
  const publicUrl = storageUrlOf(env);
  const bucketOf = storage ?? ((bucket: Bucket) => serverStorage(env, bucket));
  if (!connectionString || !publicUrl) return result;

  const { db, close } = open(connectionString);
  try {
    // The leftovers first: one cheap Storage call each, so a conversion that runs out of time
    // (the encoder is the slow part) can't keep them waiting.
    for (const { path, bucket } of await leftoverOriginals(db as AnyDb, ORIGINALS_CLEANUP_BATCH)) {
      const target = bucketOf(bucket);
      if (!target) break;
      if (await removeOriginal(db as AnyDb, target, bucket, path)) result.removed += 1;
    }
    for (const { path, bucket } of await picturesToConvert(db, batch)) {
      try {
        const target = bucketOf(bucket);
        if (!target) return result;
        // A run that stored the WebP but stopped before the rows moved: move them, without encoding
        // the picture again.
        const webpPath = path.replace(/\.(png|jpe?g)$/i, '') + '.webp';
        if (await isStored(db as AnyDb, bucket, webpPath)) {
          await repointPicture(db as AnyDb, bucket, path, webpPath);
          result.converted += 1;
          if (await removeOriginal(db as AnyDb, target, bucket, path)) result.removed += 1;
          log.info('images.webp_reused', { bucket });
          continue;
        }
        const response = await fetcher(`${publicUrl}/${bucket}/${path}`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`storage answered ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const contentType = detectImageType(bytes);
        if (!contentType) throw new Error('not_an_image');
        const image: PreparedImage = { bytes, contentType, path };
        // The same name with a `.webp` end; nothing is stored when it couldn't be converted.
        const webp = await compressed(image, log);
        if (webp === image || webp.contentType !== 'image/webp') throw new Error('not_converted');
        // Upsert: a run that stored the WebP but stopped before the rows moved writes it again.
        const { error } = await target.upload(webp.path, webp.bytes, {
          contentType: webp.contentType,
          upsert: true,
          cacheControl: cacheControlFor(webp.path),
        });
        if (error) throw new Error(`upload refused: ${error.message}`);
        await repointPicture(db as AnyDb, bucket, path, webp.path);
        result.converted += 1;
        if (await removeOriginal(db as AnyDb, target, bucket, path)) result.removed += 1;
        log.info('images.converted', {
          bucket,
          imageType: contentType,
          bytesBefore: bytes.length,
          bytesAfter: webp.bytes.length,
        });
      } catch (error) {
        result.failed += 1;
        log.warn('images.convert_failed', { code: 'image_convert_failed', bucket, error });
      }
    }
  } finally {
    await close();
  }
  return result;

  /** Deletes a converted original once no row points at it; a refusal waits for a later run. */
  async function removeOriginal(db: AnyDb, target: BucketStorage, bucket: Bucket, path: string) {
    if (await stillUsed(db, bucket, path)) return false;
    const { error } = await target.remove([path]);
    if (error) {
      log.warn('images.original_not_removed', {
        code: 'image_original_not_removed',
        bucket,
        error: error.message,
      });
      return false;
    }
    return true;
  }
}
