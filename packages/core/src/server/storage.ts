import { createClient } from '@supabase/supabase-js';
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
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  /** The legacy name of the secret key. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

/** How long one Storage call may take before the upload counts as failed. */
const TIMEOUT_MS = 10_000;

/**
 * The bucket through the server's secret key, or null when the secrets are not configured (the
 * form then says the upload failed). The client exposes Storage only.
 */
export function serverStorage(env: unknown, bucket: string): BucketStorage | null {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY } =
    (env as StorageEnv | undefined) ?? {};
  const key = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }),
    },
  }).storage.from(bucket);
}

/**
 * Whether `path` is a plain file path inside `folder`, so a stored path can never make the server
 * delete someone else's file.
 */
export const isInside = (path: string, folder: string) =>
  path.startsWith(`${folder}/`) && !path.split('/').some((part) => part === '..' || part === '');
