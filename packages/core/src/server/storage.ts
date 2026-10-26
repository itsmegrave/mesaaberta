import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';
import type { ImageStorage } from './images';

/**
 * One Storage bucket as the server uses it: upload a checked image, delete files. Every write goes
 * through the server with its own key, so Storage needs no write policy for signed-in people and
 * nobody can put a file in a bucket without the server's checks (`prepareImage`).
 */
export type BucketStorage = ImageStorage & {
  remove(paths: string[]): PromiseLike<{ error: { message: string } | null }>;
};

export type StorageEnv = {
  /** `supabase` (the default) or `s3`, for any S3-compatible store (R2, MinIO, AWS S3). */
  STORAGE_PROVIDER?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  /** The legacy name of the secret key. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** The S3 API endpoint, without the bucket: `https://<account>.r2.cloudflarestorage.com`. */
  S3_ENDPOINT?: string;
  /** One bucket for everything; the app's buckets are the first folder of each key. */
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  /** `auto` for R2; the bucket's region elsewhere (MinIO takes `us-east-1`). */
  S3_REGION?: string;
};

/** How long one Storage call may take before the upload counts as failed. */
const TIMEOUT_MS = 10_000;

const timed: typeof fetch = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

/**
 * The bucket through the server's own key, or null when storage is not configured (the form then
 * says the upload failed). Supabase Storage unless `STORAGE_PROVIDER=s3`.
 */
export function serverStorage(env: unknown, bucket: string): BucketStorage | null {
  const config = (env as StorageEnv | undefined) ?? {};
  return config.STORAGE_PROVIDER === 's3'
    ? s3Storage(config, bucket)
    : supabaseStorage(config, bucket);
}

/** Supabase Storage with the secret key. The client exposes Storage only. */
function supabaseStorage(env: StorageEnv, bucket: string): BucketStorage | null {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) return null;
  return createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timed },
  }).storage.from(bucket);
}

/**
 * Any S3-compatible store, signed with `aws4fetch` (only `fetch` and WebCrypto, so it runs on
 * Workers and Bun alike). Keys are `<bucket>/<path>` in one store bucket, path-style, which R2,
 * MinIO and AWS S3 all accept; browsers read them from `STORAGE_PUBLIC_URL` (see `storageUrlOf`).
 */
function s3Storage(env: StorageEnv, bucket: string): BucketStorage | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  const client = new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    service: 's3',
    region: env.S3_REGION || 'auto',
    retries: 0,
  });
  const objectUrl = (path: string) =>
    [S3_ENDPOINT.replace(/\/+$/, ''), S3_BUCKET, bucket, ...path.split('/')]
      .map((part, i) => (i === 0 ? part : encodeURIComponent(part)))
      .join('/');
  const failure = async (response: Response) => ({
    error: { message: `${response.status} ${(await response.text()).slice(0, 200)}`.trim() },
  });
  const send = (url: string, init: RequestInit) =>
    client.sign(url, init).then((signed) => timed(signed));

  return {
    async upload(path, body, { contentType, upsert, cacheControl }) {
      const response = await send(objectUrl(path), {
        method: 'PUT',
        body: body as BodyInit,
        headers: {
          'content-type': contentType,
          'cache-control': `max-age=${cacheControl}`,
          // Never overwrite: a name taken answers 412, like Supabase's "already exists".
          ...(upsert ? {} : { 'if-none-match': '*' }),
        },
      });
      return response.ok ? { error: null } : failure(response);
    },
    async remove(paths) {
      for (const path of paths) {
        const response = await send(objectUrl(path), { method: 'DELETE' });
        // A file already gone is what the caller wanted.
        if (!response.ok && response.status !== 404) return failure(response);
      }
      return { error: null };
    },
  };
}

/**
 * Whether `path` is a plain file path inside `folder`, so a stored path can never make the server
 * delete someone else's file.
 */
export const isInside = (path: string, folder: string) =>
  path.startsWith(`${folder}/`) && !path.split('/').some((part) => part === '..' || part === '');
